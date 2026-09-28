"""Monthly-climatology-relative accumulation heuristic; not an IMD category."""

from typing import Any


FIXED_CLOUDBURST_THRESHOLD_MM_HR = 100.0


def assess_rain_anomaly(
    accumulation_mm: float,
    window_hours: float,
    month: int,
    monthly_mean_mm: float,
    monthly_sd_mm: float,
    *,
    status: str = "SIMULATED_DEMO_FIXTURE",
) -> dict[str, Any]:
    """Compare event accumulation with a station's monthly climatology.

    Project heuristics: EXTREME at ratio >= 3 or z >= 4; ANOMALOUS at
    ratio >= 1.5 or z >= 2; otherwise NORMAL. These are not IMD categories.
    """
    if not 1 <= int(month) <= 12:
        raise ValueError("month must be in 1..12")
    if accumulation_mm < 0 or window_hours <= 0 or monthly_mean_mm <= 0 or monthly_sd_mm <= 0:
        raise ValueError("accumulation must be non-negative; window, mean, and SD must be positive")

    rate_mm_hr = float(accumulation_mm) / float(window_hours)
    exceedance_ratio = float(accumulation_mm) / float(monthly_mean_mm)
    z_score = (float(accumulation_mm) - float(monthly_mean_mm)) / float(monthly_sd_mm)
    if exceedance_ratio >= 3.0 or z_score >= 4.0:
        classification = "EXTREME"
    elif exceedance_ratio >= 1.5 or z_score >= 2.0:
        classification = "ANOMALOUS"
    else:
        classification = "NORMAL"

    return {
        "name": "rain_anomaly",
        "status": status,
        "available": True,
        "month": int(month),
        "accumulation_mm": float(accumulation_mm),
        "window_hours": float(window_hours),
        "monthly_mean_mm": float(monthly_mean_mm),
        "monthly_sd_mm": float(monthly_sd_mm),
        "exceedance_ratio": exceedance_ratio,
        "z_score": z_score,
        "rate_mm_hr": rate_mm_hr,
        "class": classification,
        "triggered": classification != "NORMAL",
        "heuristic_cutoffs": {
            "anomalous": "exceedance_ratio >= 1.5 or z_score >= 2",
            "extreme": "exceedance_ratio >= 3 or z_score >= 4",
            "authority": "Project heuristic; not IMD-official categories.",
        },
        "fixed_threshold_comparison": {
            "criterion_mm_hr": FIXED_CLOUDBURST_THRESHOLD_MM_HR,
            "triggered": rate_mm_hr >= FIXED_CLOUDBURST_THRESHOLD_MM_HR,
        },
    }


def unavailable_rain_anomaly(status: str = "UNAVAILABLE") -> dict[str, Any]:
    return {
        "name": "rain_anomaly",
        "status": status,
        "available": False,
        "message": "Accumulation, window, and monthly station climatology are required.",
    }