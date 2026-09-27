"""Synthetic reconstructions informed by Indian convective-event character.

These are deterministic fixtures, not claims of real radar reanalysis or
official event reconstruction.
"""

import numpy as np


def synthetic_case_studies(seed: int = 26084):
    rng = np.random.default_rng(seed)
    cases = []
    specs = [
        ("Himachal monsoon cloudburst character", 64.0, 0.82),
        ("Delhi-NCR pre-monsoon hail/dust-storm character", 56.0, 0.58),
        ("Bay-of-Bengal coastal squall-line character", 50.0, 0.68),
    ]
    for name, peak, persistence in specs:
        latest = np.maximum(0.0, rng.normal(peak * 0.7, 8.0, (32, 32)))
        observed = np.maximum(0.0, latest + rng.normal(0.0, 5.0, latest.shape))
        observed[10:22, 10:22] += peak * persistence
        cases.append({"name": name, "label": "SYNTHETIC_RECONSTRUCTION", "latest": latest, "observed": observed})
    return cases
