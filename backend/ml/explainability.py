"""Runtime SHAP explanations for the persisted Gradient Boosting model."""

from typing import Any, Dict, Sequence

import numpy as np


def explain_gradient_boosting(model: Any, feature_names: Sequence[str], feature_values: Sequence[float]) -> Dict[str, Any]:
    """Return TreeExplainer contributions for the model's predicted class."""
    try:
        import shap
    except ImportError as exc:
        raise RuntimeError("shap is required for model explanations") from exc

    row = np.asarray([feature_values], dtype=float)
    predicted_class = int(model.predict(row)[0])
    # SHAP 0.45+ rejects multiclass GradientBoostingClassifier directly. Its
    # fitted class-specific tree ensembles are still explainable individually;
    # summing their TreeExplainer outputs gives the exact class decision-space
    # contribution used by the persisted model, without inventing attributions.
    class_trees = [estimator[predicted_class] for estimator in model.estimators_]
    contributions = np.zeros(len(feature_names), dtype=float)
    base_value = 0.0
    for tree in class_trees:
        explainer = shap.TreeExplainer(tree)
        contributions += np.asarray(explainer.shap_values(row))[0] * float(model.learning_rate)
        base_value += float(np.asarray(explainer.expected_value).reshape(-1)[0]) * float(model.learning_rate)
    return {
        "predicted_class": predicted_class,
        "base_value": base_value,
        "features": [
            {"name": name, "value": float(value), "shap_value": float(contribution)}
            for name, value, contribution in zip(feature_names, feature_values, contributions)
        ],
        "method": "shap.TreeExplainer per fitted class tree, summed with model learning rate",
    }