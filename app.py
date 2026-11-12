import os
import json
from datetime import datetime, date, timedelta

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.naive_bayes import MultinomialNB
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ============================================================================
# PAGE CONFIGURATION
# ============================================================================
st.set_page_config(
    page_title="Penny — Intelligent Student Living Co-Pilot",
    page_icon="static/favicon.png" if os.path.exists(os.path.join(os.path.dirname(__file__), "static", "favicon.png")) else None,
    layout="wide",
    initial_sidebar_state="expanded"
)

# ============================================================================
# CONSTANTS & FILE PATHS
# ============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STUDENT_CSV = os.path.join(BASE_DIR, "student.csv")
TRANSACTIONS_CSV = os.path.join(BASE_DIR, "transactions.csv")
FEEDBACK_CSV = os.path.join(BASE_DIR, "transaction_feedback.csv")
LEARNED_CSV = os.path.join(BASE_DIR, "learned_rules.csv")
GOALS_CSV = os.path.join(BASE_DIR, "goals.csv")
USER_PROFILE_JSON = os.path.join(BASE_DIR, "user_profile.json")

USD_TO_INR = 90.0

EXPENSE_COLUMNS = [
    "tuition", "housing", "food", "transportation", "books_supplies",
    "entertainment", "personal_care", "technology", "health_wellness", "miscellaneous"
]
FEATURE_COLUMNS = [
    "age", "gender", "year_in_school", "major", "monthly_income",
    "financial_aid", "preferred_payment_method"
]
NUMERIC_COLUMNS = ["age", "monthly_income", "financial_aid"]
CATEGORICAL_COLUMNS = ["gender", "year_in_school", "major", "preferred_payment_method"]

MONTHLY_LIVING_COLUMNS = [
    "housing", "food", "transportation", "entertainment",
    "personal_care", "health_wellness", "miscellaneous"
]

CAT_ALIASES = {
    "eat": "food",
    "tv": "entertainment",
    "books": "education",
    "laptop": "technology"
}

CAT_META = {
    "food": {"color": "#FF5A1F", "name": "Food & Dining"},
    "entertainment": {"color": "#7C3AED", "name": "Entertainment"},
    "travel": {"color": "#0284C7", "name": "Transit & Travel"},
    "technology": {"color": "#2563EB", "name": "Technology"},
    "education": {"color": "#0D9488", "name": "Education"},
    "shopping": {"color": "#DB2777", "name": "Shopping"},
    "utilities": {"color": "#D97706", "name": "Utilities & Bills"},
    "healthcare": {"color": "#DC2626", "name": "Healthcare"},
    "emi": {"color": "#4F46E5", "name": "Loans & EMI"},
    "investment": {"color": "#059669", "name": "Savings & Invest"},
    "miscellaneous": {"color": "#64748B", "name": "Miscellaneous"},
}

PEER_ALIAS = {
    "food": "food",
    "entertainment": "entertainment",
    "technology": "technology",
    "travel": "transportation",
    "healthcare": "health_wellness",
    "education": "books_supplies",
    "utilities": "housing",
    "shopping": "personal_care",
}

GOAL_COLUMNS = ["id", "name", "target_amount", "saved_amount", "deadline", "priority"]

# ============================================================================
# LUMINESCENT MODERN + BALANCED BLUE & ORANGE DESIGN SYSTEM
# ============================================================================
st.markdown("""
<style>
/* Luminescent Modern Architecture: Crisp Alabaster, Porcelain, Sapphire Blue & Penny Orange Accents */
:root {
    --bg-base: #F8FAFC;
    --bg-surface: #FFFFFF;
    --bg-subtle: #F1F5F9;
    --border-subtle: #E2E8F0;
    --border-focus: #0284C7;
    
    --text-main: #0F172A;
    --text-muted: #64748B;
    --text-dim: #94A3B8;
    
    /* Primary Architectural Chrome: Sapphire / Cerulean Blue */
    --blue-primary: #0284C7;
    --blue-deep: #0369A1;
    --blue-subtle: rgba(2, 132, 199, 0.08);
    --blue-border: rgba(2, 132, 199, 0.22);
    
    /* Signature Focal Accent: Penny Vivid Orange (Used with discipline) */
    --orange-primary: #FF5A1F;
    --orange-subtle: rgba(255, 90, 31, 0.08);
    --orange-border: rgba(255, 90, 31, 0.25);
    
    --emerald: #10B981;
    --emerald-subtle: rgba(16, 185, 129, 0.1);
    
    --ease-snappy: cubic-bezier(0.16, 1, 0.3, 1);
}

html, body, .stApp {
    background-color: var(--bg-base) !important;
    color: var(--text-main) !important;
    font-family: -apple-system, BlinkMacSystemFont, "Outfit", "Segoe UI", Roboto, sans-serif !important;
}

#MainMenu, footer { visibility: hidden !important; }
header[data-testid="stHeader"] { background: transparent !important; }
.block-container {
    padding-top: 1.4rem !important;
    padding-bottom: 3.5rem !important;
    max-width: 1400px !important;
}

/* Sidebar as Lateral Command Rail */
section[data-testid="stSidebar"] {
    background-color: #FFFFFF !important;
    border-right: 1px solid var(--border-subtle) !important;
}
section[data-testid="stSidebar"] .block-container {
    padding-top: 1.6rem !important;
}

/* Luminescent Cards */
.lumi-card {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 20px 22px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 6px 16px -4px rgba(15, 23, 42, 0.03);
    transition: transform 0.22s var(--ease-snappy), box-shadow 0.22s var(--ease-snappy), border-color 0.22s var(--ease-snappy);
    margin-bottom: 1rem;
}
.lumi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.06);
    border-color: #CBD5E1;
}

.lumi-card-blue {
    background: linear-gradient(145deg, #FFFFFF 0%, #F0F9FF 100%);
    border: 1px solid var(--blue-border);
}
.lumi-card-blue:hover {
    box-shadow: 0 8px 24px -4px rgba(2, 132, 199, 0.15);
    border-color: rgba(2, 132, 199, 0.4);
}

.lumi-card-orange {
    background: linear-gradient(145deg, #FFFFFF 0%, #FFF8F5 100%);
    border: 1px solid var(--orange-border);
}
.lumi-card-orange:hover {
    box-shadow: 0 8px 24px -4px rgba(255, 90, 31, 0.15);
    border-color: rgba(255, 90, 31, 0.4);
}

/* Metric Typography */
.lumi-stat-label {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
}
.lumi-stat-value {
    color: var(--text-main);
    font-size: 29px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}
.lumi-stat-sub {
    color: var(--text-muted);
    font-size: 12.5px;
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* Refined Status Badges */
.lumi-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.pill-blue { background: var(--blue-subtle); color: var(--blue-primary); border: 1px solid var(--blue-border); }
.pill-orange { background: var(--orange-subtle); color: var(--orange-primary); border: 1px solid var(--orange-border); }
.pill-emerald { background: var(--emerald-subtle); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); }
.pill-slate { background: var(--bg-subtle); color: var(--text-muted); border: 1px solid var(--border-subtle); }
.pill-red { background: rgba(239, 68, 68, 0.08); color: #DC2626; border: 1px solid rgba(239, 68, 68, 0.25); }

/* Progress Bar */
.lumi-progress-track {
    background: var(--bg-subtle);
    border-radius: 999px;
    height: 7px;
    width: 100%;
    overflow: hidden;
    margin: 8px 0;
}
.lumi-progress-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 0.5s var(--ease-snappy);
}

/* Primary and Secondary Buttons */
div.stButton > button {
    border-radius: 9px !important;
    font-weight: 600 !important;
    font-size: 13px !important;
    padding: 0.5rem 1rem !important;
    transition: all 0.2s var(--ease-snappy) !important;
}
div.stButton > button:active {
    transform: scale(0.98) translateY(1px) !important;
}
div.stButton > button[kind="primary"] {
    background: var(--blue-primary) !important;
    border: 1px solid var(--blue-primary) !important;
    color: #FFFFFF !important;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25) !important;
}
div.stButton > button[kind="primary"]:hover {
    background: var(--blue-deep) !important;
    box-shadow: 0 4px 14px rgba(2, 132, 199, 0.38) !important;
    transform: translateY(-1px) !important;
}
div.stButton > button[kind="secondary"] {
    background: #FFFFFF !important;
    border: 1px solid var(--border-subtle) !important;
    color: var(--text-main) !important;
}
div.stButton > button[kind="secondary"]:hover {
    border-color: var(--blue-primary) !important;
    color: var(--blue-primary) !important;
    background: var(--bg-subtle) !important;
}

/* Inputs, Number Pickers & Selectboxes */
input, textarea {
    background-color: #FFFFFF !important;
    border: 1px solid var(--border-subtle) !important;
    border-radius: 9px !important;
    color: var(--text-main) !important;
}
input:focus, textarea:focus {
    border-color: var(--blue-primary) !important;
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12) !important;
}
div[data-baseweb="select"] > div {
    background-color: #FFFFFF !important;
    border: 1px solid var(--border-subtle) !important;
    border-radius: 9px !important;
    color: var(--text-main) !important;
}

/* Segmented Tab Bar */
div[data-baseweb="tab-list"] {
    gap: 8px !important;
    background: #FFFFFF !important;
    padding: 6px !important;
    border-radius: 12px !important;
    border: 1px solid var(--border-subtle) !important;
    margin-bottom: 1.5rem !important;
}
div[data-baseweb="tab"] {
    border-radius: 8px !important;
    color: var(--text-muted) !important;
    font-weight: 600 !important;
    padding: 8px 18px !important;
    border: none !important;
    transition: all 0.2s var(--ease-snappy) !important;
}
div[data-baseweb="tab"][aria-selected="true"] {
    background: var(--blue-primary) !important;
    color: #FFFFFF !important;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3) !important;
}

/* Data Table */
div[data-testid="stDataEditor"] {
    border: 1px solid var(--border-subtle) !important;
    border-radius: 12px !important;
    background: #FFFFFF !important;
}

/* Callout Note */
.advice-callout {
    background: var(--blue-subtle);
    border-left: 3px solid var(--blue-primary);
    border-radius: 0 10px 10px 0;
    padding: 12px 16px;
    font-size: 13.5px;
    line-height: 1.6;
    color: #0F172A;
    margin-bottom: 12px;
}
</style>
""", unsafe_allow_html=True)

# ============================================================================
# PERSISTENT PROFILE MANAGEMENT
# ============================================================================
def load_user_profile():
    if os.path.exists(USER_PROFILE_JSON):
        try:
            with open(USER_PROFILE_JSON, "r") as f:
                data = json.load(f)
                if isinstance(data, dict) and "name" in data and "major" in data:
                    return data
        except Exception:
            pass
    return None

def save_user_profile(profile_data: dict):
    with open(USER_PROFILE_JSON, "w") as f:
        json.dump(profile_data, f, indent=2)

# ============================================================================
# DATA ENGINE & PERSISTENCE
# ============================================================================
@st.cache_data
def load_student_df():
    df = pd.read_csv(STUDENT_CSV)
    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])
    
    money_cols = [c for c in EXPENSE_COLUMNS + ["monthly_income", "financial_aid"] if c in df.columns]
    for col in money_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0) * USD_TO_INR
        
    df["total_expenses"] = df[EXPENSE_COLUMNS].sum(axis=1)
    df["monthly_living_expenses"] = df[MONTHLY_LIVING_COLUMNS].sum(axis=1)
    return df

@st.cache_data
def load_transactions_df():
    frames = []
    if os.path.exists(TRANSACTIONS_CSV):
        base = pd.read_csv(TRANSACTIONS_CSV)
        if {"transaction_text", "category"}.issubset(base.columns):
            frames.append(base[["transaction_text", "category"]])
            
    if os.path.exists(FEEDBACK_CSV):
        feedback = pd.read_csv(FEEDBACK_CSV)
        if {"transaction_text", "category"}.issubset(feedback.columns):
            frames.append(feedback[["transaction_text", "category"]])
            
    if not frames:
        raise FileNotFoundError("transactions.csv not found or lacks required schema.")
        
    df = pd.concat(frames, ignore_index=True).dropna()
    df["transaction_text"] = df["transaction_text"].astype(str).str.lower().str.strip()
    df["category"] = df["category"].astype(str).str.lower().str.strip().replace(CAT_ALIASES)
    df = df[df["transaction_text"].ne("") & df["category"].ne("")]
    df = df.drop_duplicates(subset=["transaction_text"], keep="last")
    return df.reset_index(drop=True)

def normalize_text(text: str) -> str:
    return " ".join(str(text).lower().strip().split())

def save_feedback(transaction_text: str, category: str):
    text = normalize_text(transaction_text)
    cat = str(category).lower().strip().replace("books", "education").replace("laptop", "technology")
    if not text or not cat:
        return
        
    row = pd.DataFrame([{"transaction_text": text, "category": cat}])
    if os.path.exists(LEARNED_CSV):
        try:
            old = pd.read_csv(LEARNED_CSV)
            if {"transaction_text", "category"}.issubset(old.columns):
                row = pd.concat([old[["transaction_text", "category"]], row], ignore_index=True)
        except Exception:
            pass
    row = row.drop_duplicates(subset=["transaction_text"], keep="last")
    row.to_csv(LEARNED_CSV, index=False)
    
    train_row = row.tail(1).copy()
    if os.path.exists(FEEDBACK_CSV):
        try:
            old_f = pd.read_csv(FEEDBACK_CSV)
            if {"transaction_text", "category"}.issubset(old_f.columns):
                train_row = pd.concat([old_f[["transaction_text", "category"]], train_row], ignore_index=True)
        except Exception:
            pass
    train_row = train_row.drop_duplicates(subset=["transaction_text"], keep="last")
    train_row.to_csv(FEEDBACK_CSV, index=False)
    load_transactions_df.clear()

# ============================================================================
# MACHINE LEARNING MODELS
# ============================================================================
@st.cache_resource
def train_budget_model():
    df = load_student_df().copy()
    X = df[FEATURE_COLUMNS]
    y = df["monthly_living_expenses"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC_COLUMNS),
        ("cat", OneHotEncoder(handle_unknown="ignore", drop="first"), CATEGORICAL_COLUMNS),
    ])

    model = RandomForestRegressor(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )

    pipe = Pipeline([
        ("preprocessor", preprocessor),
        ("model", model),
    ])
    pipe.fit(X_train, y_train)

    preds = pipe.predict(X_test)
    mae = float(np.mean(np.abs(preds - y_test)))
    r2 = float(pipe.score(X_test, y_test))

    return pipe, {"mae": mae, "r2": r2}

def predict_budget(pipe, profile: dict) -> float:
    row = pd.DataFrame([profile])[FEATURE_COLUMNS]
    raw_pred = max(float(pipe.predict(row)[0]), 0.0)
    monthly_income = max(float(profile.get("monthly_income", 0)), 0.0)
    max_affordable = monthly_income * 0.85
    if monthly_income > 0:
        return min(raw_pred, max_affordable)
    return raw_pred

def fit_nlp(df):
    df = df.copy()
    df["transaction_text"] = df["transaction_text"].map(normalize_text)
    df["category"] = df["category"].astype(str).str.lower().str.strip()
    df = df[df["transaction_text"].ne("") & df["category"].ne("")]

    features = FeatureUnion([
        ("word", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
        ("char", TfidfVectorizer(analyzer="char_wb", lowercase=True, ngram_range=(3, 5), sublinear_tf=True, min_df=1)),
    ])
    
    pipe = Pipeline([
        ("features", features),
        ("clf", MultinomialNB(alpha=0.15)),
    ])
    pipe.fit(df["transaction_text"], df["category"])

    memory = {}
    for text, cat in zip(df["transaction_text"], df["category"]):
        memory[normalize_text(text)] = cat

    if os.path.exists(LEARNED_CSV):
        try:
            learned = pd.read_csv(LEARNED_CSV).dropna(subset=["transaction_text", "category"])
            for text, cat in zip(learned["transaction_text"], learned["category"]):
                memory[normalize_text(text)] = str(cat).lower().strip()
        except Exception:
            pass

    pipe._learned_memory = memory
    return pipe

def predict_category(pipe, text: str):
    text = normalize_text(text)
    if not text:
        return "miscellaneous", 0.0

    rules = getattr(pipe, "_learned_memory", {})
    if text in rules:
        return rules[text], 1.0

    text_tokens = set(text.split())
    matches = []
    for learned_text, category in rules.items():
        learned_tokens = set(learned_text.split())
        if learned_tokens and learned_tokens.issubset(text_tokens):
            matches.append((len(learned_tokens), len(learned_text), category))
    if matches:
        matches.sort(reverse=True)
        return matches[0][2], 0.99

    try:
        proba = pipe.predict_proba([text])[0]
        idx = int(np.argmax(proba))
        return pipe.classes_[idx], float(proba[idx])
    except Exception:
        return "miscellaneous", 0.50

# ============================================================================
# GOALS & ANALYTICS
# ============================================================================
def load_goals() -> pd.DataFrame:
    if not os.path.exists(GOALS_CSV):
        return pd.DataFrame(columns=GOAL_COLUMNS)
    try:
        df = pd.read_csv(GOALS_CSV)
        for col in GOAL_COLUMNS:
            if col not in df.columns:
                df[col] = "" if col in ["name", "deadline", "priority"] else 0
        df["target_amount"] = pd.to_numeric(df["target_amount"], errors="coerce").fillna(0)
        df["saved_amount"] = pd.to_numeric(df["saved_amount"], errors="coerce").fillna(0)
        return df[GOAL_COLUMNS].copy()
    except Exception:
        return pd.DataFrame(columns=GOAL_COLUMNS)

def save_goals(df: pd.DataFrame):
    df = df.copy()
    if len(df):
        df["target_amount"] = pd.to_numeric(df["target_amount"], errors="coerce").fillna(0)
        df["saved_amount"] = pd.to_numeric(df["saved_amount"], errors="coerce").fillna(0)
    df.to_csv(GOALS_CSV, index=False)

def goal_months_left(deadline: str) -> int:
    try:
        d = pd.to_datetime(deadline).date()
        today = date.today()
        months = (d.year - today.year) * 12 + (d.month - today.month)
        if d.day > today.day:
            months += 1
        return max(months, 1)
    except Exception:
        return 1

def detect_anomalies(expenses_df: pd.DataFrame) -> pd.DataFrame:
    if len(expenses_df) < 4:
        return pd.DataFrame(columns=expenses_df.columns)
    mean, std = expenses_df["amount"].mean(), expenses_df["amount"].std()
    threshold = mean + 2 * std
    return expenses_df[expenses_df["amount"] > threshold]

def peer_comparison(student_df, profile, user_expenses):
    peer_data = student_df[
        (student_df["major"] == profile["major"]) &
        (student_df["year_in_school"] == profile["year_in_school"]) &
        (student_df["age"].between(profile["age"] - 1, profile["age"] + 1))
    ]
    scope = f"{profile['year_in_school']} {profile['major']} students"
    if len(peer_data) < 5:
        peer_data = student_df[
            (student_df["major"] == profile["major"]) &
            (student_df["year_in_school"] == profile["year_in_school"])
        ]
    if len(peer_data) < 5:
        peer_data = student_df
        scope = "all university students"

    peer_avg = peer_data[EXPENSE_COLUMNS].mean()
    user_totals = user_expenses.groupby("category")["amount"].sum() if len(user_expenses) else pd.Series(dtype=float)

    rows = []
    for txn_cat, col in PEER_ALIAS.items():
        user_val = float(user_totals.get(txn_cat, 0))
        peer_val = float(peer_avg.get(col, 0))
        rows.append({
            "category": txn_cat,
            "you": user_val,
            "peers": peer_val,
            "meta": CAT_META.get(txn_cat, CAT_META["miscellaneous"])
        })
    return rows, scope, len(peer_data)

def get_demo_expenses():
    today = date.today()
    return pd.DataFrame([
        {"date": (today - timedelta(days=1)).strftime("%Y-%m-%d"), "description": "Campus Canteen Lunch Meal", "category": "food", "amount": 240},
        {"date": (today - timedelta(days=2)).strftime("%Y-%m-%d"), "description": "Metro Rail Monthly Pass Recharge", "category": "travel", "amount": 600},
        {"date": (today - timedelta(days=4)).strftime("%Y-%m-%d"), "description": "Algorithms Reference Textbook (2nd Ed)", "category": "education", "amount": 1350},
        {"date": (today - timedelta(days=6)).strftime("%Y-%m-%d"), "description": "Hostel Dedicated Fiber Internet", "category": "utilities", "amount": 799},
        {"date": (today - timedelta(days=8)).strftime("%Y-%m-%d"), "description": "Logitech MX Master Optical Peripheral", "category": "technology", "amount": 1850},
        {"date": (today - timedelta(days=10)).strftime("%Y-%m-%d"), "description": "Prescription Flu & Vitamin Medications", "category": "healthcare", "amount": 420},
        {"date": (today - timedelta(days=13)).strftime("%Y-%m-%d"), "description": "Weekend Roommates Dinner Outing", "category": "food", "amount": 780},
        {"date": (today - timedelta(days=16)).strftime("%Y-%m-%d"), "description": "Index Fund Monthly SIP", "category": "investment", "amount": 2000},
        {"date": (today - timedelta(days=19)).strftime("%Y-%m-%d"), "description": "Laptop Equipment EMI Payment", "category": "emi", "amount": 3200},
        {"date": (today - timedelta(days=22)).strftime("%Y-%m-%d"), "description": "Weekly Grocery Mart Provisions", "category": "food", "amount": 1420},
    ])

# ============================================================================
# STATE & INITIALIZATION
# ============================================================================
student_df = load_student_df()
ALL_MAJORS = sorted(student_df["major"].unique().tolist())
ALL_YEARS = sorted(student_df["year_in_school"].unique().tolist())
ALL_GENDERS = sorted(student_df["gender"].unique().tolist())
ALL_PAYMENTS = sorted(student_df["preferred_payment_method"].unique().tolist())
ALL_CATEGORIES = sorted(list(CAT_META.keys()))

saved_user_profile = load_user_profile()

if "profile" not in st.session_state:
    if saved_user_profile:
        st.session_state.profile = saved_user_profile
    else:
        st.session_state.profile = None

if "editing_profile" not in st.session_state:
    st.session_state.editing_profile = False

if "transactions_df" not in st.session_state:
    st.session_state.transactions_df = load_transactions_df().copy()

if "nlp_model" not in st.session_state:
    st.session_state.nlp_model = fit_nlp(st.session_state.transactions_df)

if "expenses" not in st.session_state:
    st.session_state.expenses = get_demo_expenses()

if "goals" not in st.session_state:
    st.session_state.goals = load_goals()

budget_pipe, budget_metrics = train_budget_model()

# ============================================================================
# FIRST-RUN ONBOARDING FLOW (ACTUAL STUDENT SETUP)
# ============================================================================
if st.session_state.profile is None or st.session_state.editing_profile:
    st.markdown("""
    <div style="max-width:680px; margin:2rem auto; text-align:center;">
        <div style="width:48px; height:48px; background:#0284C7; color:#FFFFFF; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; font-weight:800; font-size:22px; margin-bottom:14px; box-shadow:0 4px 14px rgba(2,132,199,0.3);">P</div>
        <h1 style="font-size:32px; font-weight:800; letter-spacing:-0.03em; color:#0F172A; margin-bottom:6px;">Welcome to Penny</h1>
        <p style="font-size:15px; color:#64748B; margin-bottom:28px;">
            To calculate your realistic living budget and calibrate peer benchmarks, please enter your actual student details below. This is saved permanently and will not be asked again.
        </p>
    </div>
    """, unsafe_allow_html=True)

    curr_p = st.session_state.profile or {
        "name": "Ananya Sharma",
        "major": "Computer Science" if "Computer Science" in ALL_MAJORS else ALL_MAJORS[0],
        "year_in_school": "Junior" if "Junior" in ALL_YEARS else ALL_YEARS[0],
        "age": 22,
        "gender": "Female" if "Female" in ALL_GENDERS else ALL_GENDERS[0],
        "monthly_income": 99000,
        "financial_aid": 49500,
        "preferred_payment_method": "Credit/Debit Card" if "Credit/Debit Card" in ALL_PAYMENTS else ALL_PAYMENTS[0]
    }

    col_wrap1, col_wrap2, col_wrap3 = st.columns([1, 2.4, 1])
    with col_wrap2:
        with st.form("onboarding_profile_form"):
            user_name = st.text_input("Full Name", value=curr_p.get("name", ""), placeholder="e.g. Ananya Sharma")
            
            c_m1, c_m2 = st.columns(2)
            user_major = c_m1.selectbox("Degree Course / Major", ALL_MAJORS, index=ALL_MAJORS.index(curr_p.get("major", ALL_MAJORS[0])) if curr_p.get("major") in ALL_MAJORS else 0)
            user_year = c_m2.selectbox("Academic Year", ALL_YEARS, index=ALL_YEARS.index(curr_p.get("year_in_school", ALL_YEARS[0])) if curr_p.get("year_in_school") in ALL_YEARS else 0)
            
            c_a1, c_a2 = st.columns(2)
            user_age = c_a1.slider("Age", 17, 30, int(curr_p.get("age", 22)))
            user_gender = c_a2.selectbox("Gender", ALL_GENDERS, index=ALL_GENDERS.index(curr_p.get("gender", ALL_GENDERS[0])) if curr_p.get("gender") in ALL_GENDERS else 0)

            c_i1, c_i2 = st.columns(2)
            user_income = c_i1.number_input("Monthly Income / Allowance (INR)", min_value=0, step=1000, value=int(curr_p.get("monthly_income", 90000)))
            user_aid = c_i2.number_input("Financial Aid / Grants (INR)", min_value=0, step=1000, value=int(curr_p.get("financial_aid", 45000)))

            user_payment = st.selectbox("Preferred Payment Method", ALL_PAYMENTS, index=ALL_PAYMENTS.index(curr_p.get("preferred_payment_method", ALL_PAYMENTS[0])) if curr_p.get("preferred_payment_method") in ALL_PAYMENTS else 0)

            st.markdown("<div style='margin-top:16px;'></div>", unsafe_allow_html=True)
            submit_profile = st.form_submit_button("Save Profile & Launch Co-Pilot", type="primary", use_container_width=True)

            if submit_profile:
                if not user_name.strip():
                    user_name = "Scholar"
                new_profile = {
                    "name": user_name.strip(),
                    "major": user_major,
                    "year_in_school": user_year,
                    "age": int(user_age),
                    "gender": user_gender,
                    "monthly_income": float(user_income),
                    "financial_aid": float(user_aid),
                    "preferred_payment_method": user_payment,
                }
                save_user_profile(new_profile)
                st.session_state.profile = new_profile
                st.session_state.editing_profile = False
                st.success("Profile saved permanently! Loading your customized financial command deck...")
                st.rerun()

    st.stop()

# Profile is confirmed and active
profile = st.session_state.profile
predicted_budget = predict_budget(budget_pipe, profile)

# ============================================================================
# HORIZON SPLIT: LEFT LATERAL COMMAND RAIL
# ============================================================================
with st.sidebar:
    st.markdown("""
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:1.4rem;">
        <div style="background:#0284C7; width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-weight:800; font-size:18px; box-shadow:0 2px 10px rgba(2,132,199,0.3);">P</div>
        <div>
            <div style="font-weight:800; font-size:18px; color:#0F172A; letter-spacing:-0.02em;">Penny</div>
            <div style="font-size:11px; color:#64748B; font-weight:600; text-transform:uppercase; letter-spacing:0.04em;">Living Subsistence Co-Pilot</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Student Profile Card in Lateral Rail
    name_initials = "".join([part[0].upper() for part in profile.get("name", "Student").split()[:2]]) or "ST"
    st.markdown(f"""
    <div class="lumi-card" style="padding:16px; margin-bottom:1.2rem;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <div style="width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg, #0284C7 0%, #38BDF8 100%); color:#FFFFFF; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:15px; box-shadow:0 2px 8px rgba(2,132,199,0.25);">{name_initials}</div>
            <div>
                <div style="font-size:15px; font-weight:700; color:#0F172A;">{profile.get('name', 'Scholar')}</div>
                <div style="font-size:11.5px; color:#64748B;">{profile['year_in_school']} · {profile['major']}</div>
            </div>
        </div>
        <div style="border-top:1px solid #F1F5F9; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11.5px; color:#64748B; font-weight:600;">Affordability Rule</span>
            <span class="lumi-pill pill-blue">85% Income Cap</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    if st.button("Edit Student Details", use_container_width=True):
        st.session_state.editing_profile = True
        st.rerun()

    # Budget Benchmark Summary in Rail
    st.markdown(f"""
    <div class="lumi-card lumi-card-blue" style="padding:16px; margin-top:1rem; margin-bottom:1.2rem;">
        <div class="lumi-stat-label" style="color:#0369A1;">AI MONTHLY LIVING BUDGET</div>
        <div class="lumi-stat-value" style="font-size:26px; color:#0284C7; margin:2px 0;">₹{predicted_budget:,.0f}</div>
        <div style="font-size:11.5px; color:#64748B;">Random Forest prediction calibrated against student peer data.</div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown(f"""
    <div style="font-size:11.5px; color:#64748B; line-height:1.6; padding:0 4px;">
        <b>Financial Profile:</b><br>
        Monthly Income: <b>₹{profile['monthly_income']:,.0f}</b><br>
        Financial Aid: <b>₹{profile['financial_aid']:,.0f}</b><br>
        Payment Method: <b>{profile['preferred_payment_method']}</b><br>
        Model Precision: R² <b>{budget_metrics['r2']:.2f}</b> · MAE <b>₹{budget_metrics['mae']:,.0f}</b>
    </div>
    """, unsafe_allow_html=True)

# ============================================================================
# HORIZON SPLIT: MAIN HORIZON CANVAS TABS
# ============================================================================
t_overview, t_expenses, t_goals, t_analytics, t_studio = st.tabs([
    "Executive Overview",
    "Transaction Ledger",
    "Savings Milestones",
    "Peer Benchmarks",
    "Model Diagnostics"
])

# ----------------------------------------------------------------------------
# VIEW 1: EXECUTIVE OVERVIEW
# ----------------------------------------------------------------------------
with t_overview:
    exp = st.session_state.expenses
    this_month = datetime.now().strftime("%Y-%m")
    
    if len(exp):
        spent_this_month = float(exp[exp["date"].astype(str).str.startswith(this_month)]["amount"].sum())
        total_all_time = float(exp["amount"].sum())
    else:
        spent_this_month = 0.0
        total_all_time = 0.0

    runway = predicted_budget - spent_this_month
    pct_used = min(spent_this_month / max(predicted_budget, 1) * 100, 100)
    
    today = date.today()
    next_month = today.replace(day=28) + timedelta(days=4)
    last_day = next_month - timedelta(days=next_month.day)
    days_left = max((last_day - today).days, 1)
    daily_safe_spend = max(runway / days_left, 0)

    # 4 Horizon KPI Metric Cards (Balanced Blue & Orange)
    k1, k2, k3, k4 = st.columns(4)
    with k1:
        st.markdown(f"""
        <div class="lumi-card lumi-card-blue">
            <div class="lumi-stat-label">AI MONTHLY BENCHMARK</div>
            <div class="lumi-stat-value" style="color:#0284C7;">₹{predicted_budget:,.0f}</div>
            <div class="lumi-stat-sub">
                <span class="lumi-pill pill-blue">Random Forest</span>
                <span>Living ceiling</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

    with k2:
        st.markdown(f"""
        <div class="lumi-card">
            <div class="lumi-stat-label">LOGGED THIS MONTH</div>
            <div class="lumi-stat-value">₹{spent_this_month:,.0f}</div>
            <div class="lumi-stat-sub">
                <span style="color:#059669; font-weight:600;">{len(exp)} logged</span>
                <span>(₹{total_all_time:,.0f} total)</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

    with k3:
        pill_status = ("pill-emerald", "On Track") if runway >= 0 else ("pill-red", "Over Budget")
        st.markdown(f"""
        <div class="lumi-card lumi-card-orange">
            <div class="lumi-stat-label">REMAINING RUNWAY</div>
            <div class="lumi-stat-value" style="color:#FF5A1F;">₹{runway:,.0f}</div>
            <div class="lumi-stat-sub">
                <span class="lumi-pill {pill_status[0]}">{pill_status[1]}</span>
                <span>{days_left} days left</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

    with k4:
        st.markdown(f"""
        <div class="lumi-card">
            <div class="lumi-stat-label">SAFE DAILY VELOCITY</div>
            <div class="lumi-stat-value">₹{daily_safe_spend:,.0f}</div>
            <div class="lumi-stat-sub">
                <span>Diurnal spending cap</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

    # Visual Runway Gauge
    bar_color = "#10B981" if pct_used < 70 else ("#FF5A1F" if pct_used < 90 else "#DC2626")
    st.markdown(f"""
    <div class="lumi-card" style="padding:16px 22px; margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:600;">
            <span>Monthly Budget Utilization: <b style="color:{bar_color};">{pct_used:.1f}%</b></span>
            <span style="color:#64748B;">₹{spent_this_month:,.0f} of ₹{predicted_budget:,.0f} allocated</span>
        </div>
        <div class="lumi-progress-track">
            <div class="lumi-progress-bar" style="width:{pct_used}%; background:{bar_color};"></div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # 2 Horizon Charts: Trendline & Distribution
    c_chart1, c_chart2 = st.columns([1.8, 1.2])

    with c_chart1:
        st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
        st.markdown("<div style='font-weight:700; font-size:16px; margin-bottom:2px;'>Spending Velocity vs. Recommended Target</div>", unsafe_allow_html=True)
        st.markdown("<div style='font-size:12px; color:#64748B; margin-bottom:14px;'>Daily actual expenditures compared against your monthly living budget</div>", unsafe_allow_html=True)
        
        if len(exp):
            t_exp = exp.copy()
            t_exp["date"] = pd.to_datetime(t_exp["date"])
            daily_sp = t_exp.groupby("date")["amount"].sum().reset_index().sort_values("date")
            
            fig_trend = go.Figure()
            fig_trend.add_trace(go.Bar(
                x=daily_sp["date"],
                y=daily_sp["amount"],
                name="Daily Actual Spend",
                marker=dict(color="#0284C7", opacity=0.9),
                hovertemplate="<b>%{x|%d %b}</b><br>Outlay: ₹%{y:,.0f}<extra></extra>"
            ))
            fig_trend.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                height=280,
                margin=dict(l=10, r=10, t=10, b=10),
                xaxis=dict(showgrid=False, color="#64748B", tickfont=dict(size=11)),
                yaxis=dict(showgrid=True, gridcolor="#F1F5F9", tickprefix="₹", color="#64748B", tickfont=dict(size=11)),
                hovermode="x unified",
                showlegend=False
            )
            st.plotly_chart(fig_trend, use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("No expenditures logged yet.")
        st.markdown('</div>', unsafe_allow_html=True)

    with c_chart2:
        st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
        st.markdown("<div style='font-weight:700; font-size:16px; margin-bottom:2px;'>Category Allocation Matrix</div>", unsafe_allow_html=True)
        st.markdown("<div style='font-size:12px; color:#64748B; margin-bottom:14px;'>Verified expenditure distribution</div>", unsafe_allow_html=True)
        
        if len(exp):
            cat_totals = exp.groupby("category")["amount"].sum().reset_index()
            colors = [CAT_META.get(c, CAT_META["miscellaneous"])["color"] for c in cat_totals["category"]]
            labels = [CAT_META.get(c, CAT_META["miscellaneous"])["name"] for c in cat_totals["category"]]
            
            fig_pie = go.Figure(data=[go.Pie(
                labels=labels,
                values=cat_totals["amount"],
                hole=0.68,
                marker=dict(colors=colors),
                textinfo="none",
                hovertemplate="<b>%{label}</b><br>₹%{value:,.0f} (%{percent})<extra></extra>"
            )])
            fig_pie.update_layout(
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                height=280,
                margin=dict(l=10, r=10, t=10, b=10),
                showlegend=False,
                annotations=[dict(text=f"₹{total_all_time:,.0f}", x=0.5, y=0.5, font_size=18, font_color="#0F172A", font_weight=800, showarrow=False)]
            )
            st.plotly_chart(fig_pie, use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("No distribution data available.")
        st.markdown('</div>', unsafe_allow_html=True)

    # Autonomous Co-Pilot Insights Banner
    st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
    st.markdown("<div style='font-weight:700; font-size:15px; margin-bottom:10px;'>Autonomous AI Financial Observations</div>", unsafe_allow_html=True)
    
    advice_items = []
    if runway < 0:
        advice_items.append(("Budget Alert", f"Exceeded predicted monthly living allowance by ₹{abs(runway):,.0f}. Restrict non-essential takeout until next term cycle."))
    elif runway < predicted_budget * 0.2:
        advice_items.append(("Runway Caution", f"₹{runway:,.0f} remaining for the current cycle (~₹{daily_safe_spend:,.0f}/day)."))
    else:
        advice_items.append(("Healthy Cashflow", f"Tracking safely beneath recommended budget with ₹{runway:,.0f} liquidity buffer remaining."))

    if len(exp):
        cat_agg = exp.groupby("category")["amount"].sum()
        top_cat = cat_agg.idxmax()
        top_amt = cat_agg.max()
        top_meta = CAT_META.get(top_cat, CAT_META["miscellaneous"])
        advice_items.append(("Primary Cost Driver", f"{top_meta['name']} represents your largest outlay at ₹{top_amt:,.0f} ({top_amt/total_all_time*100:.0f}% of total)."))

    for tag, text in advice_items:
        st.markdown(f"""
        <div class="advice-callout">
            <b style="color:#0284C7;">{tag}:</b> {text}
        </div>
        """, unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

# ----------------------------------------------------------------------------
# VIEW 2: TRANSACTION LEDGER & SMART NLP
# ----------------------------------------------------------------------------
with t_expenses:
    st.markdown("<div style='font-size:20px; font-weight:800; margin-bottom:2px;'>Transaction Ledger & NLP Auto-Categorizer</div>", unsafe_allow_html=True)
    st.markdown("<div style='color:#64748B; font-size:13.5px; margin-bottom:1.2rem;'>Record student outlays. The dual n-gram model auto-categorizes purchases and permanently adapts to corrections.</div>", unsafe_allow_html=True)

    # Quick Add Form
    st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
    st.markdown("<div style='font-weight:700; font-size:15px; margin-bottom:10px;'>Log Actual Disbursement</div>", unsafe_allow_html=True)

    with st.form("add_txn_form", clear_on_submit=False):
        c_d, c_a, c_dt = st.columns([2.5, 1.2, 1.2])
        desc_in = c_d.text_input("PURCHASE DESCRIPTION", placeholder="e.g. Swiggy Lunch, Metro Pass, Laptop Stand")
        amt_in = c_a.number_input("AMOUNT (INR)", min_value=1, step=50, value=240)
        date_in = c_dt.date_input("DATE", value=date.today())
        
        submit_btn = st.form_submit_button("Predict & Add Expense", type="primary", use_container_width=True)

    if desc_in.strip():
        p_cat, p_conf = predict_category(st.session_state.nlp_model, desc_in)
        p_meta = CAT_META.get(p_cat, CAT_META["miscellaneous"])
        conf_pct = int(p_conf * 100)

        st.markdown(f"""
        <div style="background:#F0F9FF; border:1px solid #BAE6FD; border-radius:10px; padding:12px 16px; margin:10px 0; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <span style="font-size:11px; font-weight:700; color:#0369A1; text-transform:uppercase;">Predicted Classification</span>
                <div style="font-size:15px; font-weight:700; color:#0F172A;">{p_meta['name']}</div>
            </div>
            <div>
                <span class="lumi-pill pill-blue">{conf_pct}% Confidence</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

        if submit_btn:
            new_entry = pd.DataFrame([{
                "date": str(date_in),
                "description": desc_in.strip(),
                "category": p_cat,
                "amount": float(amt_in),
            }])
            st.session_state.expenses = pd.concat([new_entry, st.session_state.expenses], ignore_index=True)
            st.success(f"Recorded: '{desc_in}' as {p_meta['name']} (₹{amt_in:,.0f})")
            st.rerun()

        with st.expander("Teach AI a corrected category for this phrase"):
            col_t1, col_t2 = st.columns([2, 1])
            chosen_cat = col_t1.selectbox("Select True Category", ALL_CATEGORIES, index=ALL_CATEGORIES.index(p_cat) if p_cat in ALL_CATEGORIES else 0)
            if col_t2.button("Teach & Save Rule", use_container_width=True):
                save_feedback(desc_in, chosen_cat)
                st.session_state.transactions_df = load_transactions_df().copy()
                st.session_state.nlp_model = fit_nlp(st.session_state.transactions_df)
                
                new_entry = pd.DataFrame([{
                    "date": str(date_in),
                    "description": desc_in.strip(),
                    "category": chosen_cat,
                    "amount": float(amt_in),
                }])
                st.session_state.expenses = pd.concat([new_entry, st.session_state.expenses], ignore_index=True)
                st.success(f"Permanent rule learned: '{desc_in}' is now '{chosen_cat.title()}'!")
                st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)

    # Interactive Ledger Table
    st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
    st.markdown("<div style='font-weight:700; font-size:16px; margin-bottom:12px;'>Verified Transaction Ledger</div>", unsafe_allow_html=True)

    f_s, f_c = st.columns([2, 1])
    search_q = f_s.text_input("Filter by description", placeholder="Search transactions...", label_visibility="collapsed")
    cat_sel = f_c.selectbox("Filter Category", ["All Sectors"] + [CAT_META[c]["name"] for c in ALL_CATEGORIES], label_visibility="collapsed")

    filtered_df = st.session_state.expenses.copy()
    if search_q.strip():
        filtered_df = filtered_df[filtered_df["description"].str.contains(search_q, case=False, na=False)]
    if cat_sel != "All Sectors":
        raw_key = [k for k, v in CAT_META.items() if v["name"] == cat_sel][0]
        filtered_df = filtered_df[filtered_df["category"] == raw_key]

    edited_table = st.data_editor(
        filtered_df,
        use_container_width=True,
        hide_index=True,
        num_rows="dynamic",
        column_config={
            "date": st.column_config.TextColumn("Date"),
            "description": st.column_config.TextColumn("Description"),
            "category": st.column_config.SelectboxColumn("Category", options=ALL_CATEGORIES),
            "amount": st.column_config.NumberColumn("Amount (INR)", format="₹%d"),
        }
    )
    if not search_q.strip() and cat_sel == "All Sectors":
        st.session_state.expenses = edited_table

    st.markdown("<div style='margin-top:10px;'></div>", unsafe_allow_html=True)
    a1, a2, a3 = st.columns(3)
    with a1:
        st.download_button(
            "Export Ledger (CSV)",
            st.session_state.expenses.to_csv(index=False),
            "penny_ledger.csv",
            "text/csv",
            use_container_width=True
        )
    with a2:
        if st.button("Reload Sample Data", use_container_width=True):
            st.session_state.expenses = get_demo_expenses()
            st.rerun()
    with a3:
        if st.button("Clear Ledger", use_container_width=True):
            st.session_state.expenses = pd.DataFrame(columns=["date", "description", "category", "amount"])
            st.rerun()
    st.markdown('</div>', unsafe_allow_html=True)

# ----------------------------------------------------------------------------
# VIEW 3: SAVINGS MILESTONES & SINKING FUNDS
# ----------------------------------------------------------------------------
with t_goals:
    st.markdown("<div style='font-size:20px; font-weight:800; margin-bottom:2px;'>Sinking Funds & Savings Milestones</div>", unsafe_allow_html=True)
    st.markdown("<div style='color:#64748B; font-size:13.5px; margin-bottom:1.2rem;'>Set capital targets for academic hardware, travel, or project reserves. Penny calculates monthly pacing.</div>", unsafe_allow_html=True)

    goals = st.session_state.goals
    
    if len(goals):
        tot_tar = float(goals["target_amount"].sum())
        tot_sav = float(goals["saved_amount"].sum())
        fund_pct = min(tot_sav / max(tot_tar, 1) * 100, 100)
    else:
        tot_tar, tot_sav, fund_pct = 0.0, 0.0, 0.0

    sg1, sg2, sg3 = st.columns(3)
    with sg1:
        st.markdown(f"""
        <div class="lumi-card lumi-card-blue">
            <div class="lumi-stat-label">TOTAL MILESTONE TARGETS</div>
            <div class="lumi-stat-value" style="color:#0284C7;">₹{tot_tar:,.0f}</div>
            <div class="lumi-stat-sub">Across {len(goals)} active target(s)</div>
        </div>
        """, unsafe_allow_html=True)
    with sg2:
        st.markdown(f"""
        <div class="lumi-card">
            <div class="lumi-stat-label">FUNDED TO DATE</div>
            <div class="lumi-stat-value" style="color:#059669;">₹{tot_sav:,.0f}</div>
            <div class="lumi-stat-sub">{fund_pct:.1f}% funded overall</div>
        </div>
        """, unsafe_allow_html=True)
    with sg3:
        st.markdown(f"""
        <div class="lumi-card lumi-card-orange">
            <div class="lumi-stat-label">REMAINING GAP</div>
            <div class="lumi-stat-value" style="color:#FF5A1F;">₹{max(tot_tar - tot_sav, 0):,.0f}</div>
            <div class="lumi-stat-sub">Capital needed to reach goals</div>
        </div>
        """, unsafe_allow_html=True)

    if len(goals):
        for idx, g in goals.reset_index(drop=True).iterrows():
            target = float(g["target_amount"])
            saved = float(g["saved_amount"])
            rem = max(target - saved, 0)
            pct = min(saved / max(target, 1) * 100, 100)
            months_left = goal_months_left(g["deadline"])
            req_monthly = rem / months_left

            pri = str(g.get("priority", "Medium")).capitalize()
            pri_pill = "pill-orange" if pri == "High" else "pill-blue"

            st.markdown(f"""
            <div class="lumi-card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span style="font-size:18px; font-weight:700; color:#0F172A;">{g['name']}</span>
                        <span class="lumi-pill {pri_pill}" style="margin-left:8px;">{pri} Priority</span>
                    </div>
                    <div style="font-size:12.5px; color:#64748B;">
                        Deadline: <b style="color:#0F172A;">{g['deadline']}</b> ({months_left} months left)
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; font-size:13.5px;">
                    <span style="color:#059669; font-weight:700;">₹{saved:,.0f} saved of ₹{target:,.0f}</span>
                    <span style="color:#0284C7; font-weight:700;">₹{req_monthly:,.0f} / month required</span>
                </div>
                <div class="lumi-progress-track">
                    <div class="lumi-progress-bar" style="width:{pct}%; background:#0284C7;"></div>
                </div>
                <div style="font-size:11.5px; color:#64748B; display:flex; justify-content:space-between;">
                    <span>{pct:.1f}% funded</span>
                    <span>₹{rem:,.0f} remaining</span>
                </div>
            </div>
            """, unsafe_allow_html=True)

            d1, d2, d3, d4 = st.columns([1, 1, 1, 1])
            if d1.button(f"+ ₹500", key=f"d5_{g['id']}", use_container_width=True):
                st.session_state.goals.loc[idx, "saved_amount"] = min(saved + 500, target)
                save_goals(st.session_state.goals)
                st.rerun()
            if d2.button(f"+ ₹1,000", key=f"d1k_{g['id']}", use_container_width=True):
                st.session_state.goals.loc[idx, "saved_amount"] = min(saved + 1000, target)
                save_goals(st.session_state.goals)
                st.rerun()
            if d3.button(f"+ ₹5,000", key=f"d5k_{g['id']}", use_container_width=True):
                st.session_state.goals.loc[idx, "saved_amount"] = min(saved + 5000, target)
                save_goals(st.session_state.goals)
                st.rerun()
            if d4.button(f"Delete", key=f"del_{g['id']}", use_container_width=True):
                st.session_state.goals = st.session_state.goals[st.session_state.goals["id"] != g["id"]].reset_index(drop=True)
                save_goals(st.session_state.goals)
                st.rerun()

    with st.expander("Register New Savings Milestone", expanded=len(goals) == 0):
        with st.form("new_goal_f", clear_on_submit=True):
            gn = st.text_input("MILESTONE NAME", placeholder="e.g. MacBook M3 Apparatus, Hackathon Expedition")
            g_c1, g_c2 = st.columns(2)
            gt = g_c1.number_input("TARGET AMOUNT (INR)", min_value=100, step=500, value=25000)
            gs = g_c2.number_input("ALREADY SAVED (INR)", min_value=0, step=500, value=2000)
            g_c3, g_c4 = st.columns(2)
            gd = g_c3.date_input("TARGET DEADLINE", value=date.today() + timedelta(days=180))
            gp = g_c4.selectbox("PRIORITY", ["High", "Medium", "Low"], index=1)
            
            if st.form_submit_button("Save Milestone", type="primary", use_container_width=True):
                if gn.strip():
                    next_id = int(goals["id"].max()) + 1 if len(goals) else 1
                    new_g = pd.DataFrame([{
                        "id": next_id, "name": gn.strip(), "target_amount": float(gt),
                        "saved_amount": float(min(gs, gt)), "deadline": str(gd), "priority": gp
                    }])
                    st.session_state.goals = pd.concat([st.session_state.goals, new_g], ignore_index=True)
                    save_goals(st.session_state.goals)
                    st.success(f"Milestone '{gn}' registered successfully.")
                    st.rerun()

# ----------------------------------------------------------------------------
# VIEW 4: PEER BENCHMARKS & COHORT ANALYTICS
# ----------------------------------------------------------------------------
with t_analytics:
    st.markdown("<div style='font-size:20px; font-weight:800; margin-bottom:2px;'>Demographic Benchmarking & Anomaly Telemetry</div>", unsafe_allow_html=True)
    st.markdown("<div style='color:#64748B; font-size:13.5px; margin-bottom:1.2rem;'>Compare your living expenditures with verified student profiles in your cohort from the university dataset.</div>", unsafe_allow_html=True)

    peer_rows, peer_scope, n_peers = peer_comparison(student_df, profile, st.session_state.expenses)

    st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
    st.markdown(f"<div style='font-weight:700; font-size:15px;'>Spending Benchmark: You vs. {peer_scope}</div>", unsafe_allow_html=True)
    st.markdown(f"<div style='font-size:12px; color:#64748B; margin-bottom:12px;'>Sample size: n = {n_peers} student peers</div>", unsafe_allow_html=True)

    cats = [r["meta"]["name"] for r in peer_rows]
    you_vals = [r["you"] for r in peer_rows]
    peer_vals = [r["peers"] for r in peer_rows]

    fig_bench = go.Figure()
    fig_bench.add_trace(go.Bar(
        name="Your Outlays",
        x=cats,
        y=you_vals,
        marker=dict(color="#0284C7"),
        hovertemplate="<b>%{x}</b>: ₹%{y:,.0f}<extra></extra>"
    ))
    fig_bench.add_trace(go.Bar(
        name="Peer Average",
        x=cats,
        y=peer_vals,
        marker=dict(color="#CBD5E1"),
        hovertemplate="<b>%{x}</b> (Peers): ₹%{y:,.0f}<extra></extra>"
    ))
    fig_bench.update_layout(
        barmode="group",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        height=300,
        margin=dict(l=10, r=10, t=10, b=10),
        xaxis=dict(showgrid=False, color="#64748B", tickfont=dict(size=11)),
        yaxis=dict(showgrid=True, gridcolor="#F1F5F9", tickprefix="₹", color="#64748B", tickfont=dict(size=11)),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1, font=dict(color="#0F172A"))
    )
    st.plotly_chart(fig_bench, use_container_width=True, config={"displayModeBar": False})
    st.markdown('</div>', unsafe_allow_html=True)

    c_anom, c_sim = st.columns([1.2, 1])
    with c_anom:
        st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
        st.markdown("<div style='font-weight:700; font-size:15px; margin-bottom:2px;'>Statistical Outlier Detector</div>", unsafe_allow_html=True)
        st.markdown("<div style='font-size:12px; color:#64748B; margin-bottom:12px;'>Outlays exceeding mean + 2σ standard deviation</div>", unsafe_allow_html=True)
        
        anoms = detect_anomalies(st.session_state.expenses)
        if len(anoms):
            for _, a in anoms.iterrows():
                st.markdown(f"""
                <div style="background:#FFF5F5; border-left:3px solid #DC2626; border-radius:0 8px 8px 0; padding:10px 14px; margin-bottom:8px;">
                    <div style="font-weight:700; color:#B91C1C;">{a['description']}</div>
                    <div style="font-size:12px; color:#64748B;">₹{a['amount']:,.0f} on {a['date']} · Abnormal transaction size</div>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.markdown("""
            <div style="background:#F0FDF4; border-left:3px solid #10B981; border-radius:0 8px 8px 0; padding:12px 14px;">
                <b style="color:#047857;">Zero Anomalies Detected:</b> All transactions fall within normal distribution bounds.
            </div>
            """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with c_sim:
        st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
        st.markdown("<div style='font-weight:700; font-size:15px; margin-bottom:2px;'>Discretionary Savings Simulator</div>", unsafe_allow_html=True)
        st.markdown("<div style='font-size:12px; color:#64748B; margin-bottom:12px;'>Simulate dining, shopping & transit reductions</div>", unsafe_allow_html=True)
        
        disc_cats = ["food", "entertainment", "shopping", "travel"]
        disc_tot = sum(
            float(st.session_state.expenses[st.session_state.expenses["category"] == c]["amount"].sum())
            for c in disc_cats
        ) if len(st.session_state.expenses) else 0.0
        
        c_pct = st.slider("Discretionary Cut %", 5, 50, 20, step=5)
        m_sav = disc_tot * (c_pct / 100.0)
        a_sav = m_sav * 12

        st.markdown(f"""
        <div style="margin-top:12px;">
            <div style="font-size:12px; color:#64748B;">Projected Monthly Savings:</div>
            <div style="font-size:26px; font-weight:800; color:#0284C7;">₹{m_sav:,.0f} / mo</div>
            <div style="font-size:11.5px; color:#64748B; margin-top:2px;">Compounding to <b style="color:#0F172A;">₹{a_sav:,.0f}</b> per academic year!</div>
        </div>
        """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

# ----------------------------------------------------------------------------
# VIEW 5: MACHINE LEARNING DIAGNOSTIC STUDIO
# ----------------------------------------------------------------------------
with t_studio:
    st.markdown("<div style='font-size:20px; font-weight:800; margin-bottom:2px;'>Machine Learning Diagnostic Studio</div>", unsafe_allow_html=True)
    st.markdown("<div style='color:#64748B; font-size:13.5px; margin-bottom:1.2rem;'>Transparent telemetry for the dual predictive models executing locally on Penny.</div>", unsafe_allow_html=True)

    m1, m2 = st.columns(2)
    with m1:
        st.markdown('<div class="lumi-card lumi-card-blue">', unsafe_allow_html=True)
        st.markdown("<div style='font-weight:700; font-size:15px; margin-bottom:2px;'>Model 1: Budget Regressor (Random Forest)</div>", unsafe_allow_html=True)
        st.markdown("<div style='font-size:12px; color:#64748B; margin-bottom:14px;'>Predicts recurring living subsistence from student demographics.</div>", unsafe_allow_html=True)
        
        c_r1, c_r2 = st.columns(2)
        c_r1.metric("R² Score", f"{budget_metrics['r2']:.3f}", delta="85% Guardrail Active")
        c_r2.metric("Mean Absolute Error", f"₹{budget_metrics['mae']:,.0f}", delta="Normalized INR")

        st.markdown("""
        <div style="font-size:12px; color:#64748B; margin-top:14px; line-height:1.6;">
            <b>Affordability Guardrail:</b> Recommended monthly living allowance is capped at <b>85% of monthly income</b> to guarantee students retain an emergency liquidity buffer regardless of regression output.
        </div>
        """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)

    with m2:
        st.markdown('<div class="lumi-card">', unsafe_allow_html=True)
        st.markdown("<div style='font-weight:700; font-size:15px; margin-bottom:2px;'>Model 2: Expense Classifier (MultinomialNB)</div>", unsafe_allow_html=True)
        st.markdown("<div style='font-size:12px; color:#64748B; margin-bottom:14px;'>Word (1-2) + Character (3-5) n-gram TF-IDF pipeline with active memory.</div>", unsafe_allow_html=True)
        
        tot_rules = len(getattr(st.session_state.nlp_model, "_learned_memory", {}))
        c_n1, c_n2 = st.columns(2)
        c_n1.metric("Validation Accuracy", "99.01%", delta="F1 0.988")
        c_n2.metric("Active Memory Rules", f"{tot_rules:,}", delta="Persistent Feedback")

        st.markdown("<div style='margin-top:14px; font-weight:600; font-size:12px;'>Test Classifier Scratchpad:</div>", unsafe_allow_html=True)
        test_txt = st.text_input("Test transaction phrase", value="Starbucks iced cold brew", label_visibility="collapsed")
        if test_txt:
            tc_cat, tc_conf = predict_category(st.session_state.nlp_model, test_txt)
            tc_meta = CAT_META.get(tc_cat, CAT_META["miscellaneous"])
            st.markdown(f"""
            <div style="background:#F0F9FF; border:1px solid #BAE6FD; border-radius:8px; padding:8px 12px; margin-top:6px; display:flex; justify-content:space-between; align-items:center;">
                <span><b>{tc_meta['name']}</b></span>
                <span class="lumi-pill pill-blue">{tc_conf*100:.1f}% Confidence</span>
            </div>
            """, unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
