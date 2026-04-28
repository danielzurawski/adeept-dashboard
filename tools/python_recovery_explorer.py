#!/usr/bin/env python3
"""Standalone, cautious AWR-V3 occupancy explorer.

This script is intentionally separate from the vendor WebServer.py process. Run it
on the Raspberry Pi with Adeept_Robot.service stopped so it can own GPIO/I2C pins.
It uses the original Python hardware modules, but wraps movement in a small
finite-state machine that stops before recovery and only continues after a scan
finds a clear heading.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import signal
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


STOP_FILE = Path("/tmp/stop_recovery_explorer")
CELL_CM = 5.0
GRID_CELLS = 120
LOG_FREE = -0.35
LOG_OCC = 0.85
LOG_MIN = -4.0
LOG_MAX = 4.0


@dataclass
class Pose:
    x_cm: float = 0.0
    y_cm: float = 0.0
    theta_deg: float = 0.0


@dataclass
class ScanCandidate:
    heading_deg: float
    distance_cm: float
    score: float


@dataclass
class ExplorerStatus:
    state: str
    pose: Pose
    front_cm: float | None
    clear_heading_deg: float | None
    step: int
    message: str


class OccupancyGrid:
    def __init__(self, cells: int = GRID_CELLS, cell_cm: float = CELL_CM) -> None:
        self.cells = cells
        self.cell_cm = cell_cm
        self.origin = cells // 2
        self.grid = [[0.0 for _ in range(cells)] for _ in range(cells)]

    def _grid_xy(self, x_cm: float, y_cm: float) -> tuple[int, int] | None:
        gx = int(round(x_cm / self.cell_cm)) + self.origin
        gy = self.origin - int(round(y_cm / self.cell_cm))
        if 0 <= gx < self.cells and 0 <= gy < self.cells:
            return gx, gy
        return None

    def _add(self, x_cm: float, y_cm: float, delta: float) -> None:
        cell = self._grid_xy(x_cm, y_cm)
        if cell is None:
            return
        gx, gy = cell
        self.grid[gy][gx] = max(LOG_MIN, min(LOG_MAX, self.grid[gy][gx] + delta))

    def mark_robot_footprint_free(self, pose: Pose, radius_cm: float) -> None:
        for dx in frange(-radius_cm, radius_cm, self.cell_cm):
            for dy in frange(-radius_cm, radius_cm, self.cell_cm):
                if math.hypot(dx, dy) <= radius_cm:
                    self._add(pose.x_cm + dx, pose.y_cm + dy, LOG_FREE)

    def update_sonar(
        self,
        pose: Pose,
        distance_cm: float | None,
        max_range_cm: float,
        robot_radius_cm: float,
    ) -> None:
        if distance_cm is None:
            return
        heading = math.radians(pose.theta_deg)
        usable = max(0.0, min(distance_cm, max_range_cm) - robot_radius_cm)
        for r_cm in frange(0.0, usable, self.cell_cm):
            x = pose.x_cm + math.cos(heading) * r_cm
            y = pose.y_cm + math.sin(heading) * r_cm
            self._add(x, y, LOG_FREE)
        if distance_cm < max_range_cm:
            ox = pose.x_cm + math.cos(heading) * max(robot_radius_cm, distance_cm)
            oy = pose.y_cm + math.sin(heading) * max(robot_radius_cm, distance_cm)
            self._add(ox, oy, LOG_OCC)

    def to_status_counts(self) -> dict[str, int]:
        free = occupied = unknown = 0
        for row in self.grid:
            for value in row:
                if value < -0.5:
                    free += 1
                elif value > 0.5:
                    occupied += 1
                else:
                    unknown += 1
        return {"free": free, "occupied": occupied, "unknown": unknown}

    def save_pgm(self, path: Path) -> None:
        with path.open("w", encoding="ascii") as handle:
            handle.write(f"P2\n{self.cells} {self.cells}\n255\n")
            for row in self.grid:
                pixels = []
                for value in row:
                    if value > 0.5:
                        pixels.append("0")
                    elif value < -0.5:
                        pixels.append("235")
                    else:
                        pixels.append("128")
                handle.write(" ".join(pixels) + "\n")


class AlertController:
    def __init__(self, enabled: bool = True) -> None:
        self._buzzer = None
        self._leds = []
        if not enabled:
            return
        try:
            from gpiozero import LED, TonalBuzzer

            self._buzzer = TonalBuzzer(18)
            self._leds = [LED(9), LED(25), LED(11)]
        except Exception as exc:  # Hardware may be busy during dry runs.
            print(f"[alert] GPIO alert outputs unavailable: {exc}")

    def pulse(self, count: int = 2) -> None:
        if self._buzzer is None and not self._leds:
            return
        for _ in range(count):
            for led in self._leds:
                led.on()
            if self._buzzer is not None:
                self._buzzer.play("C5")
            time.sleep(0.12)
            if self._buzzer is not None:
                self._buzzer.stop()
            for led in self._leds:
                led.off()
            time.sleep(0.08)

    def close(self) -> None:
        try:
            if self._buzzer is not None:
                self._buzzer.stop()
            for led in self._leds:
                led.off()
                led.close()
        except Exception:
            pass


class Hardware:
    def __init__(self, robot_root: Path, dry_run: bool) -> None:
        self.dry_run = dry_run
        self.move = None
        self.ultra = None
        if dry_run:
            return

        server_dir = robot_root / "Server"
        sys.path.insert(0, str(server_dir))
        import Move  # type: ignore[import-not-found]
        import Ultra  # type: ignore[import-not-found]

        self.move = Move
        self.ultra = Ultra
        self.move.setup()
        self.stop()

    def stop(self) -> None:
        if self.dry_run or self.move is None:
            return
        self.move.motorStop()

    def drive(self, speed: int, direction: int, turn: str) -> None:
        if self.dry_run or self.move is None:
            print(f"[dry-run] drive speed={speed} direction={direction} turn={turn}")
            return
        self.move.move(speed, direction, turn)

    def distance_cm(self) -> float | None:
        if self.dry_run:
            return 100.0
        if self.ultra is None:
            return None
        samples: list[float] = []
        for _ in range(3):
            try:
                value = float(self.ultra.checkdist())
                if 2.0 <= value <= 200.0:
                    samples.append(value)
            except Exception as exc:
                print(f"[sonar] read failed: {exc}")
            time.sleep(0.04)
        if not samples:
            return None
        samples.sort()
        return samples[len(samples) // 2]

    def close(self) -> None:
        self.stop()
        if not self.dry_run and self.move is not None:
            try:
                self.move.destroy()
            except Exception:
                self.stop()


class RecoveryExplorer:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.pose = Pose()
        self.grid = OccupancyGrid()
        self.hardware = Hardware(Path(args.robot_root).expanduser(), args.dry_run)
        self.alerts = AlertController(enabled=not args.dry_run and not args.no_alerts)
        self.running = True
        self.last_status: ExplorerStatus | None = None
        signal.signal(signal.SIGINT, self._signal_stop)
        signal.signal(signal.SIGTERM, self._signal_stop)

    def _signal_stop(self, _signum: int, _frame: object) -> None:
        self.running = False
        self.hardware.stop()

    def save_status(self, status: ExplorerStatus) -> None:
        self.last_status = status
        payload = {
            "status": asdict(status),
            "grid": self.grid.to_status_counts(),
            "generated_at": time.time(),
        }
        Path(self.args.status_json).write_text(json.dumps(payload, indent=2), encoding="utf-8")
        self.grid.save_pgm(Path(self.args.map_pgm))

    def read_front(self) -> float | None:
        distance = self.hardware.distance_cm()
        self.grid.mark_robot_footprint_free(self.pose, self.args.robot_radius_cm)
        self.grid.update_sonar(self.pose, distance, self.args.max_range_cm, self.args.robot_radius_cm)
        return distance

    def should_stop(self) -> bool:
        return not self.running or STOP_FILE.exists()

    def cm_per_second(self) -> float:
        return self.args.cm_per_sec_at_50 * (self.args.speed / 50.0)

    def deg_per_second(self) -> float:
        return self.args.deg_per_sec_at_50 * (self.args.speed / 50.0)

    def rotate(self, delta_deg: float) -> None:
        if abs(delta_deg) < 1.0:
            return
        turn = "rotate-left" if delta_deg > 0 else "rotate-right"
        duration = abs(delta_deg) / max(1.0, self.deg_per_second())
        self.hardware.drive(self.args.speed, 1, turn)
        time.sleep(duration)
        self.hardware.stop()
        self.pose.theta_deg = normalize_deg(self.pose.theta_deg + delta_deg)
        time.sleep(self.args.settle_sec)

    def turn_to(self, heading_deg: float) -> None:
        delta = signed_angle_delta(self.pose.theta_deg, heading_deg)
        self.rotate(delta)

    def forward_pulse(self) -> bool:
        start = time.monotonic()
        self.hardware.drive(self.args.speed, 1, "no")
        while time.monotonic() - start < self.args.forward_pulse_sec:
            if self.should_stop():
                self.hardware.stop()
                return False
            front = self.hardware.distance_cm()
            if front is not None and front < self.args.stop_cm:
                self.hardware.stop()
                return False
            time.sleep(0.05)
        self.hardware.stop()

        traveled = self.cm_per_second() * self.args.forward_pulse_sec
        theta = math.radians(self.pose.theta_deg)
        self.pose.x_cm += math.cos(theta) * traveled
        self.pose.y_cm += math.sin(theta) * traveled
        return True

    def scan_for_heading(self, step_index: int) -> ScanCandidate | None:
        self.hardware.stop()
        self.alerts.pulse(2)
        start_heading = self.pose.theta_deg
        candidates: list[ScanCandidate] = []

        for scan_index in range(self.args.scan_steps):
            if self.should_stop():
                return None
            if scan_index > 0:
                self.rotate(self.args.scan_degrees)
            distance = self.read_front()
            if distance is None:
                score = -1.0
            else:
                clearance_bonus = min(distance, self.args.max_range_cm)
                score = clearance_bonus - abs(signed_angle_delta(start_heading, self.pose.theta_deg)) * 0.08
            candidate = ScanCandidate(self.pose.theta_deg, distance or -1.0, score)
            candidates.append(candidate)
            print(
                f"[scan] step={step_index} heading={candidate.heading_deg:.1f} "
                f"front={candidate.distance_cm:.1f}cm score={candidate.score:.1f}"
            )

        viable = [
            candidate
            for candidate in candidates
            if candidate.distance_cm >= self.args.clear_cm and candidate.score > 0.0
        ]
        if not viable:
            return None
        return max(viable, key=lambda candidate: candidate.score)

    def run(self) -> int:
        print("[explorer] starting cautious recovery explorer")
        print(f"[explorer] stop file: {STOP_FILE}")
        print("[explorer] press Ctrl-C or create the stop file to park")
        self.hardware.stop()
        exit_code = 0

        try:
            for step in range(1, self.args.max_steps + 1):
                if self.should_stop():
                    break

                front = self.read_front()
                status = ExplorerStatus("EXPLORE", self.pose, front, None, step, "checking forward path")
                self.save_status(status)
                print(f"[explore] step={step} pose={self.pose} front={front}")

                if front is None or front < self.args.clear_cm:
                    candidate = self.scan_for_heading(step)
                    if candidate is None:
                        self.hardware.stop()
                        self.alerts.pulse(5)
                        self.save_status(
                            ExplorerStatus("PARKED", self.pose, front, None, step, "no clear recovery heading")
                        )
                        print("[explorer] parked: no clear recovery heading")
                        return 2
                    self.turn_to(candidate.heading_deg)
                    self.save_status(
                        ExplorerStatus(
                            "RECOVERY",
                            self.pose,
                            candidate.distance_cm,
                            candidate.heading_deg,
                            step,
                            "turned to clear heading",
                        )
                    )
                    continue

                moved = self.forward_pulse()
                if not moved:
                    self.hardware.stop()
                    self.alerts.pulse(3)
                    self.save_status(
                        ExplorerStatus("RECOVERY", self.pose, front, None, step, "forward pulse interrupted")
                    )
                    continue

                self.save_status(ExplorerStatus("EXPLORE", self.pose, front, None, step, "advanced one pulse"))
                time.sleep(self.args.pause_sec)
        except Exception as exc:
            exit_code = 1
            self.hardware.stop()
            self.save_status(ExplorerStatus("ERROR", self.pose, None, None, -1, str(exc)))
            print(f"[explorer] error: {exc}")
        finally:
            self.hardware.stop()
            self.alerts.close()
            print("[explorer] motors stopped")
        return exit_code


def frange(start: float, stop: float, step: float) -> Iterable[float]:
    value = start
    while value <= stop:
        yield value
        value += step


def normalize_deg(value: float) -> float:
    return value % 360.0


def signed_angle_delta(current: float, target: float) -> float:
    return (target - current + 540.0) % 360.0 - 180.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone safe AWR-V3 recovery explorer")
    parser.add_argument("--robot-root", default="~/Adeept_AWR-V3")
    parser.add_argument("--dry-run", action="store_true", help="Do not touch GPIO/I2C motors")
    parser.add_argument("--no-alerts", action="store_true", help="Disable buzzer/LED alerts")
    parser.add_argument("--speed", type=int, default=30)
    parser.add_argument("--max-steps", type=int, default=80)
    parser.add_argument("--forward-pulse-sec", type=float, default=0.35)
    parser.add_argument("--pause-sec", type=float, default=0.15)
    parser.add_argument("--settle-sec", type=float, default=0.15)
    parser.add_argument("--stop-cm", type=float, default=25.0)
    parser.add_argument("--clear-cm", type=float, default=55.0)
    parser.add_argument("--max-range-cm", type=float, default=180.0)
    parser.add_argument("--robot-radius-cm", type=float, default=11.0)
    parser.add_argument("--scan-steps", type=int, default=8)
    parser.add_argument("--scan-degrees", type=float, default=45.0)
    parser.add_argument("--cm-per-sec-at-50", type=float, default=10.0)
    parser.add_argument("--deg-per-sec-at-50", type=float, default=180.0)
    parser.add_argument("--status-json", default="recovery_explorer_status.json")
    parser.add_argument("--map-pgm", default="recovery_explorer_map.pgm")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.speed < 1 or args.speed > 60:
        print("[explorer] refusing speed outside 1..60 for this cautious explorer")
        return 64
    explorer = RecoveryExplorer(args)
    return explorer.run()


if __name__ == "__main__":
    raise SystemExit(main())
