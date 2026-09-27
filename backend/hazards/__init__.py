"""Additive, input-aware convective hazard calculations."""

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Optional

import numpy as np


@dataclass(frozen=True)
class HazardResult:
    name: str
    field: Any
    probability: Any
    severity: Any
    unit_label: str
    status: str = "AVAILABLE"
    source: Optional[str] = None
    caveat: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return json_safe(asdict(self))


def json_safe(value: Any) -> Any:
    """Convert NumPy values recursively into JSON-native values."""
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    return value


def compact(value: Any) -> Any:
    """Return a scalar for 0-D results and lists for gridded results."""
    array = np.asarray(value)
    return array.item() if array.ndim == 0 else array.tolist()


def unavailable(
    name: str,
    unit_label: str,
    caveat: str,
    status: str = "UNAVAILABLE",
    source: Optional[str] = None,
) -> HazardResult:
    return HazardResult(
        name=name,
        field=None,
        probability=None,
        severity=None,
        unit_label=unit_label,
        status=status,
        source=source,
        caveat=caveat,
    )


from .cloudburst import assess_cloudburst
from .downburst import assess_downburst
from .hail import assess_hail
from .lightning_density import assess_lightning_density, synthetic_lightning_points

__all__ = [
    "HazardResult",
    "assess_cloudburst",
    "assess_downburst",
    "assess_hail",
    "assess_lightning_density",
    "synthetic_lightning_points",
]