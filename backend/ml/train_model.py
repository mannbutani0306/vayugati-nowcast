import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "saved_models"
MODEL_PATH = MODEL_DIR / "convective_risk_gb.pkl"
MODEL_META_PATH = MODEL_DIR / "model_meta.json"
CATALOGUE_PATH = BASE_DIR / "event_catalogue.json"
INDEPENDENT_VALIDATION_PATH = BASE_DIR / "independent_validation.csv"

FEATURE_COLUMNS = [
    "reflectivity_dbz",
    "cape_jkg",
    "cloud_top_temp_c",
    "lightning_rate_pm",
    "wind_shear_knots",
    "pwat_mm",
]


class EventCatalogueBuilder:
    @staticmethod
    def build_catalogue() -> list[dict]:
        """Return illustrative synthetic events for demonstration only.

        The hand-crafted cases are calibrated to published post-event IMD and
        meteorological-literature thresholds; they are not an operational
        training corpus. The frame/train/predict interfaces can accept a larger
        real dataset derived from BUFR, HDF5, or NetCDF when one is available.
        """
        events = [
            {"date": "2024-06-13", "region": "Pune", "reflectivity_dbz": 58.0, "cape_jkg": 3100, "cloud_top_temp_c": -64.0, "lightning_rate_pm": 52, "wind_shear_knots": 32, "pwat_mm": 54, "severity": 3, "ground_truth": "SEVERE"},
            {"date": "2024-06-24", "region": "Mumbai", "reflectivity_dbz": 52.0, "cape_jkg": 2800, "cloud_top_temp_c": -58.0, "lightning_rate_pm": 47, "wind_shear_knots": 29, "pwat_mm": 50, "severity": 3, "ground_truth": "SEVERE"},
            {"date": "2024-07-08", "region": "Nagpur", "reflectivity_dbz": 49.0, "cape_jkg": 2650, "cloud_top_temp_c": -55.0, "lightning_rate_pm": 41, "wind_shear_knots": 27, "pwat_mm": 48, "severity": 2, "ground_truth": "WARNING"},
            {"date": "2024-07-20", "region": "Dehradun", "reflectivity_dbz": 54.0, "cape_jkg": 2900, "cloud_top_temp_c": -60.0, "lightning_rate_pm": 45, "wind_shear_knots": 34, "pwat_mm": 52, "severity": 3, "ground_truth": "SEVERE"},
            {"date": "2024-08-03", "region": "Maharashtra", "reflectivity_dbz": 46.0, "cape_jkg": 2200, "cloud_top_temp_c": -48.0, "lightning_rate_pm": 26, "wind_shear_knots": 22, "pwat_mm": 45, "severity": 2, "ground_truth": "WARNING"},
            {"date": "2024-08-15", "region": "Pune", "reflectivity_dbz": 57.0, "cape_jkg": 3000, "cloud_top_temp_c": -62.0, "lightning_rate_pm": 49, "wind_shear_knots": 31, "pwat_mm": 53, "severity": 3, "ground_truth": "SEVERE"},
            {"date": "2024-09-02", "region": "Mumbai", "reflectivity_dbz": 40.0, "cape_jkg": 1700, "cloud_top_temp_c": -41.0, "lightning_rate_pm": 18, "wind_shear_knots": 18, "pwat_mm": 38, "severity": 1, "ground_truth": "WATCH"},
            {"date": "2024-09-19", "region": "Dehradun", "reflectivity_dbz": 36.0, "cape_jkg": 1600, "cloud_top_temp_c": -38.0, "lightning_rate_pm": 12, "wind_shear_knots": 16, "pwat_mm": 34, "severity": 1, "ground_truth": "WATCH"},
            {"date": "2024-10-05", "region": "Maharashtra", "reflectivity_dbz": 28.0, "cape_jkg": 980, "cloud_top_temp_c": -24.0, "lightning_rate_pm": 7, "wind_shear_knots": 13, "pwat_mm": 27, "severity": 0, "ground_truth": "INFO"},
            {"date": "2024-10-16", "region": "Nagpur", "reflectivity_dbz": 31.0, "cape_jkg": 1200, "cloud_top_temp_c": -30.0, "lightning_rate_pm": 9, "wind_shear_knots": 14, "pwat_mm": 29, "severity": 0, "ground_truth": "INFO"},
            {"date": "2024-11-02", "region": "Mumbai", "reflectivity_dbz": 45.0, "cape_jkg": 2050, "cloud_top_temp_c": -50.0, "lightning_rate_pm": 24, "wind_shear_knots": 25, "pwat_mm": 44, "severity": 2, "ground_truth": "WARNING"},
            {"date": "2024-11-11", "region": "Pune", "reflectivity_dbz": 60.0, "cape_jkg": 3400, "cloud_top_temp_c": -67.0, "lightning_rate_pm": 61, "wind_shear_knots": 36, "pwat_mm": 59, "severity": 3, "ground_truth": "SEVERE"},
            {"date": "2024-12-17", "region": "Dehradun", "reflectivity_dbz": 34.0, "cape_jkg": 1400, "cloud_top_temp_c": -36.0, "lightning_rate_pm": 11, "wind_shear_knots": 15, "pwat_mm": 33, "severity": 1, "ground_truth": "WATCH"},
            {"date": "2025-01-08", "region": "Pune", "reflectivity_dbz": 29.0, "cape_jkg": 1050, "cloud_top_temp_c": -26.0, "lightning_rate_pm": 8, "wind_shear_knots": 12, "pwat_mm": 26, "severity": 0, "ground_truth": "INFO"},
            {"date": "2025-02-14", "region": "Nagpur", "reflectivity_dbz": 50.0, "cape_jkg": 2760, "cloud_top_temp_c": -56.0, "lightning_rate_pm": 38, "wind_shear_knots": 28, "pwat_mm": 47, "severity": 2, "ground_truth": "WARNING"},
            {"date": "2025-03-25", "region": "Mumbai", "reflectivity_dbz": 53.0, "cape_jkg": 2960, "cloud_top_temp_c": -62.0, "lightning_rate_pm": 43, "wind_shear_knots": 30, "pwat_mm": 51, "severity": 3, "ground_truth": "SEVERE"},
            {"date": "2025-04-11", "region": "Dehradun", "reflectivity_dbz": 41.0, "cape_jkg": 1800, "cloud_top_temp_c": -42.0, "lightning_rate_pm": 20, "wind_shear_knots": 20, "pwat_mm": 39, "severity": 1, "ground_truth": "WATCH"},
            {"date": "2025-05-06", "region": "Maharashtra", "reflectivity_dbz": 27.0, "cape_jkg": 870, "cloud_top_temp_c": -22.0, "lightning_rate_pm": 5, "wind_shear_knots": 10, "pwat_mm": 20, "severity": 0, "ground_truth": "INFO"},
            {"date": "2025-05-22", "region": "Pune", "reflectivity_dbz": 48.0, "cape_jkg": 2490, "cloud_top_temp_c": -53.0, "lightning_rate_pm": 35, "wind_shear_knots": 26, "pwat_mm": 43, "severity": 2, "ground_truth": "WARNING"},
            {"date": "2025-06-09", "region": "Maharashtra", "reflectivity_dbz": 61.0, "cape_jkg": 3600, "cloud_top_temp_c": -70.0, "lightning_rate_pm": 64, "wind_shear_knots": 37, "pwat_mm": 62, "severity": 3, "ground_truth": "SEVERE"},
        ]
        return events


def generate_synthetic_training_events(count: int = 800, seed: int = 26084) -> list[dict]:
    """Generate labeled joint feature samples for development-only training.

    Samples vary by broad Indian season/region regimes and are not observations;
    they expand coverage while the 20 curated catalogue rows remain a separate
    textbook sanity-check set in ``EventCatalogueBuilder``.
    The labels come from a documented heuristic formula, not independent
    observations; this widens demo decision-boundary coverage but is not real
    training data. Replacing it with IMD DWR/IMDAA labels is the top roadmap item.
    """
    rng = np.random.default_rng(seed)
    regions = ["INDO_GANGETIC", "WEST_COAST", "DECCAN", "HIMALAYA", "BAY_OF_BENGAL"]
    events = []
    for index in range(count):
        region = regions[index % len(regions)]
        season = index % 4
        reflectivity = float(np.clip(rng.normal(42 + 4 * (season == 2), 10), 18, 70))
        cape = float(np.clip(rng.lognormal(np.log(1500 + 500 * (season in (1, 2))), 0.45), 100, 5000))
        lightning = float(np.clip(rng.gamma(2.2, 7.0) + max(0, reflectivity - 45) * 0.8, 0, 100))
        shear = float(np.clip(rng.normal(22, 9), 5, 50))
        pwat = float(np.clip(rng.normal(40 + (region == "BAY_OF_BENGAL") * 8, 10), 15, 80))
        cloud_top = float(np.clip(-25 - reflectivity * 0.65 - rng.normal(0, 4), -80, -15))
        score = 0.045 * (reflectivity - 30) + 0.00035 * cape + 0.018 * lightning + 0.02 * shear + 0.01 * (pwat - 35)
        severity = int(np.digitize(score, [2.0, 3.5, 5.0]))
        events.append({"date": f"synthetic-{index:04d}", "region": region, "reflectivity_dbz": reflectivity, "cape_jkg": cape, "cloud_top_temp_c": cloud_top, "lightning_rate_pm": lightning, "wind_shear_knots": shear, "pwat_mm": pwat, "severity": severity, "ground_truth": "SYNTHETIC"})
    return events


def build_training_frame() -> pd.DataFrame:
    """Return the clearly labeled synthetic augmentation training frame."""
    catalogue = generate_synthetic_training_events()
    df = pd.DataFrame(catalogue)
    df = df[FEATURE_COLUMNS + ["severity"]].copy()
    return df


def train_model() -> tuple[GradientBoostingClassifier, dict]:
    df = build_training_frame()
    curated_df = pd.DataFrame(EventCatalogueBuilder.build_catalogue())[FEATURE_COLUMNS + ["severity"]].copy()
    X = df[FEATURE_COLUMNS]
    y = df["severity"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    model = GradientBoostingClassifier(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.9,
        random_state=42,
    )
    model.fit(X_train, y_train)
    augmentation_pred = model.predict(X_test)
    curated_pred = model.predict(curated_df[FEATURE_COLUMNS])
    report = classification_report(curated_df["severity"], curated_pred, output_dict=True, zero_division=0)
    labels = ["INFO", "WATCH", "WARNING", "SEVERE"]
    # This evaluates agreement with heuristic-generated labels, not predictive skill.
    metrics = {
        "heuristic_label_consistency": float(accuracy_score(y_test, augmentation_pred)),
        "curated_textbook_sanity_accuracy": float(accuracy_score(curated_df["severity"], curated_pred)),
        "curated_textbook_rows": len(curated_df),
        "synthetic_augmentation_rows": len(df),
        "confusion_matrix": confusion_matrix(curated_df["severity"], curated_pred).tolist(),
        "classification_report": {label: report.get(str(i), {}) for i, label in enumerate(labels)},
        "feature_importances": {feature: float(score) for feature, score in zip(FEATURE_COLUMNS, model.feature_importances_)},
    }
    return model, metrics


def evaluate_independent_validation(model: GradientBoostingClassifier) -> dict | None:
    if not INDEPENDENT_VALIDATION_PATH.exists():
        print("independent validation: not provided (roadmap)")
        return None
    validation = pd.read_csv(INDEPENDENT_VALIDATION_PATH)
    if len(validation) < 5:
        print("independent validation: not provided (roadmap)")
        return None
    severity_map = {label: index for index, label in enumerate(("INFO", "WATCH", "WARNING", "SEVERE"))}
    observed = validation["observed_severity"].replace(severity_map).astype(int)
    predicted = model.predict(validation[FEATURE_COLUMNS])
    return {
        "rows": len(validation),
        "accuracy": float(accuracy_score(observed, predicted)),
        "source": "independent_validation.csv",
    }


def save_model(model: GradientBoostingClassifier) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    MODEL_META_PATH.write_text(json.dumps({
        "sklearn_version": sklearn.__version__,
        "model_file": MODEL_PATH.name,
    }, indent=2), encoding="utf-8")


def save_catalogue(catalogue: list[dict]) -> None:
    CATALOGUE_PATH.write_text(json.dumps(catalogue, indent=2), encoding="utf-8")


def main() -> None:
    catalogue = EventCatalogueBuilder.build_catalogue()
    save_catalogue(catalogue)
    model, report = train_model()
    save_model(model)
    report["independent_validation"] = evaluate_independent_validation(model)
    print(json.dumps({
        "model_path": str(MODEL_PATH),
        "catalogue_path": str(CATALOGUE_PATH),
        "metrics": report,
    }, indent=2))


if __name__ == "__main__":
    main()
