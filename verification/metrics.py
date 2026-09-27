"""Pure forecast-verification metrics for binary convective exceedance fields."""

from typing import Iterable, Sequence

import numpy as np


def _contingency(observed, predicted, threshold=0.5):
    obs = np.asarray(observed) >= threshold
    pred = np.asarray(predicted) >= threshold
    return (int(np.sum(obs & pred)), int(np.sum(~obs & pred)), int(np.sum(~obs & ~pred)), int(np.sum(obs & ~pred)))


def csi(observed, predicted, threshold=0.5):
    hits, false_alarms, _, misses = _contingency(observed, predicted, threshold)
    return hits / (hits + false_alarms + misses) if hits + false_alarms + misses else 0.0


def pod(observed, predicted, threshold=0.5):
    hits, _, _, misses = _contingency(observed, predicted, threshold)
    return hits / (hits + misses) if hits + misses else 0.0


def far(observed, predicted, threshold=0.5):
    hits, false_alarms, _, _ = _contingency(observed, predicted, threshold)
    return false_alarms / (hits + false_alarms) if hits + false_alarms else 0.0


def hss(observed, predicted, threshold=0.5):
    hits, false_alarms, correct_negatives, misses = _contingency(observed, predicted, threshold)
    total = hits + false_alarms + correct_negatives + misses
    expected = ((hits + misses) * (hits + false_alarms) + (correct_negatives + false_alarms) * (correct_negatives + misses)) / total if total else 0
    return 2 * (hits + correct_negatives - expected) / (total - expected) if total != expected else 0.0


def bias(observed, predicted, threshold=0.5):
    hits, false_alarms, _, misses = _contingency(observed, predicted, threshold)
    return (hits + false_alarms) / (hits + misses) if hits + misses else 0.0


def fss(observed, predicted, radius=1, threshold=0.5):
    obs = (np.asarray(observed) >= threshold).astype(float)
    pred = (np.asarray(predicted) >= threshold).astype(float)
    if obs.shape != pred.shape or obs.ndim != 2:
        raise ValueError("FSS inputs must be matching 2-D arrays")
    kernel = 2 * radius + 1
    def neighborhood(field):
        padded = np.pad(field, radius, mode="constant")
        return np.asarray([[padded[row:row + kernel, col:col + kernel].mean() for col in range(field.shape[1])] for row in range(field.shape[0])])
    numerator = np.mean((neighborhood(obs) - neighborhood(pred)) ** 2)
    denominator = np.mean(neighborhood(obs) ** 2 + neighborhood(pred) ** 2)
    return 1.0 - numerator / denominator if denominator else 1.0


def brier_score(observed, probability):
    return float(np.mean((np.asarray(probability, dtype=float) - np.asarray(observed, dtype=float)) ** 2))


def reliability_diagram(observed, probability, bins: int = 10):
    obs = np.asarray(observed, dtype=float).ravel()
    prob = np.asarray(probability, dtype=float).ravel()
    edges = np.linspace(0.0, 1.0, bins + 1)
    output = []
    for index in range(bins):
        mask = (prob >= edges[index]) & ((prob < edges[index + 1]) if index < bins - 1 else (prob <= edges[index + 1]))
        output.append({"bin_lower": float(edges[index]), "bin_upper": float(edges[index + 1]), "count": int(mask.sum()), "mean_probability": float(prob[mask].mean()) if mask.any() else None, "observed_frequency": float(obs[mask].mean()) if mask.any() else None})
    return output
