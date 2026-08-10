import os
from datetime import datetime, date

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

st.set_page_config(page_title="penny", page_icon="static/favicon.png", layout="wide", initial_sidebar_state="expanded")

ORANGE = "#FF5A1F"
NAVY = "#12172B"
CREAM = "#F4EFE8"
MUTED = "#667085"
GREEN = "#168A4A"
RED = "#C83E24"

st.markdown(f"""
<style>
html, body, .stApp, [data-testid="stAppViewContainer"] {{
    background: {CREAM} !important;
    color: {NAVY} !important;
    font-family: "Segoe UI", system-ui, sans-serif !important;
}}
#MainMenu, footer {{ visibility:hidden; }}
header[data-testid="stHeader"] {{ background:transparent !important; }}
div.block-container {{ padding-top:1.4rem !important; max-width:1450px !important; }}

h1,h2,h3,h4,h5,h6,p,li,
.stMarkdown, .stCaption,
[data-testid="stCaptionContainer"] {{
    color:{NAVY} !important;
}}
.stCaption, [data-testid="stCaptionContainer"] {{ color:{MUTED} !important; }}

.card {{
    background:#FFFFFF !important;
    color:{NAVY} !important;
    border:1px solid #E2DCD3;
    border-radius:18px;
    padding:22px 24px;
    box-shadow:0 2px 8px rgba(18,23,43,.05);
}}
.card * {{ color:{NAVY} !important; }}

.card-dark {{
    background:{NAVY} !important;
    color:#FFFFFF !important;
    border-radius:18px;
    padding:24px;
}}
.card-dark * {{ color:#FFFFFF !important; }}

.label {{
    color:{MUTED} !important;
    font-size:11px;
    font-weight:800;
    letter-spacing:.06em;
    text-transform:uppercase;
}}
.bignum {{ color:{NAVY} !important; font-size:34px; font-weight:800; }}
.sub {{ color:{MUTED} !important; font-size:13px; }}

input, textarea {{
    background:#FFFFFF !important;
    color:{NAVY} !important;
    -webkit-text-fill-color:{NAVY} !important;
    border-color:#CFC7BC !important;
}}
input::placeholder, textarea::placeholder {{
    color:#7A7F89 !important;
    -webkit-text-fill-color:#7A7F89 !important;
}}
label, label p {{
    color:{NAVY} !important;
}}

div[data-baseweb="select"] > div {{
    background:#FFFFFF !important;
    color:{NAVY} !important;
    border-color:#CFC7BC !important;
}}
div[data-baseweb="select"] span,
div[data-baseweb="select"] div {{ color:{NAVY} !important; }}
ul[role="listbox"], div[role="listbox"] {{ background:#FFFFFF !important; }}
li[role="option"] {{
    background:#FFFFFF !important;
    color:{NAVY} !important;
}}
li[role="option"]:hover {{
    background:#F3EEE7 !important;
    color:{NAVY} !important;
}}

div.stButton > button,
div.stDownloadButton > button {{
    border-radius:10px !important;
    font-weight:800 !important;
    min-height:42px !important;
}}
div.stButton > button[kind="primary"],
div.stDownloadButton > button[kind="primary"] {{
    background:{ORANGE} !important;
    border:1px solid {ORANGE} !important;
    color:#FFFFFF !important;
    -webkit-text-fill-color:#FFFFFF !important;
}}
div.stButton > button[kind="primary"] *,
div.stDownloadButton > button[kind="primary"] * {{
    color:#FFFFFF !important;
    -webkit-text-fill-color:#FFFFFF !important;
}}
div.stButton > button[kind="secondary"],
div.stDownloadButton > button[kind="secondary"] {{
    background:#FFFFFF !important;
    border:1px solid #CFC7BC !important;
    color:{NAVY} !important;
    -webkit-text-fill-color:{NAVY} !important;
}}
div.stButton > button[kind="secondary"] * {{
    color:{NAVY} !important;
    -webkit-text-fill-color:{NAVY} !important;
}}

section[data-testid="stSidebar"],
section[data-testid="stSidebar"] > div {{
    background:#FFFFFF !important;
}}
section[data-testid="stSidebar"] * {{ color:#787878 !important; }}
section[data-testid="stSidebar"] .sub {{ color:{MUTED} !important; }}
section[data-testid="stSidebar"] .card-dark * {{ color:#FFFFFF !important; }}

.topbar {{
    background:#FFFFFF !important;
    border:1px solid #E2DCD3;
    border-radius:16px;
    padding:14px 24px;
}}
.logo {{ color:{NAVY} !important; font-weight:800; font-size:22px; }}
.logo-icon {{ color:{ORANGE} !important; background:#FFE4D8; border-radius:10px; }}

.banner {{
    background:#FFF4EC !important;
    border:1px solid #F1D5C3;
    border-radius:18px;
    padding:26px 30px;
}}
.banner * {{ color:{NAVY} !important; }}
.banner .sub {{ color:{MUTED} !important; }}

.rec-card {{
    background:#FFF9F5 !important;
    color:{NAVY} !important;
    border:1px solid #F1DDD0;
    border-left:4px solid {ORANGE};
    border-radius:12px;
    padding:13px 16px;
    margin-bottom:9px;
}}
.rec-card * {{ color:{NAVY} !important; }}

.pill {{
    display:inline-block;
    padding:4px 12px;
    border-radius:999px;
    font-size:12px;
    font-weight:800;
}}
.pill-orange {{ background:#FFE3D2 !important; color:#B9380B !important; }}
.pill-green {{ background:#DCF3E4 !important; color:#116B39 !important; }}
.pill-red {{ background:#FBDCD6 !important; color:#A52D19 !important; }}

.barbg {{ background:#E7E2DB !important; border-radius:999px; height:8px; overflow:hidden; }}
.barfg {{ height:8px; border-radius:999px; }}

div[data-testid="stDataEditor"] {{
    background:#FFFFFF !important;
    color:{NAVY} !important;
}}
div[data-testid="stDataEditor"] * {{ color:{NAVY} !important; }}

div[data-testid="stAlert"] {{
    color:{NAVY} !important;
}}
div[data-testid="stAlert"] * {{ color:{NAVY} !important; }}

div[data-baseweb="popover"],
div[data-baseweb="menu"] {{
    background:#FFFFFF !important;
}}
div[data-baseweb="popover"] *,
div[data-baseweb="menu"] * {{ color:{NAVY} !important; }}
</style>
""", unsafe_allow_html=True)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STUDENT_CSV = os.path.join(BASE_DIR, "student.csv")
TRANSACTIONS_CSV = os.path.join(BASE_DIR, "transactions.csv")
FEEDBACK_CSV = os.path.join(BASE_DIR, "transaction_feedback.csv")
LEARNED_CSV = os.path.join(BASE_DIR, "learned_rules.csv")
GOALS_CSV = os.path.join(BASE_DIR, "goals.csv")
USD_TO_INR = 90.0

EXPENSE_COLUMNS = ["tuition", "housing", "food", "transportation", "books_supplies",
                    "entertainment", "personal_care", "technology", "health_wellness", "miscellaneous"]
FEATURE_COLUMNS = ["age", "gender", "year_in_school", "major", "monthly_income",
                    "financial_aid", "preferred_payment_method"]
NUMERIC_COLUMNS = ["age", "monthly_income", "financial_aid"]
CATEGORICAL_COLUMNS = ["gender", "year_in_school", "major", "preferred_payment_method"]

CAT_ALIASES = {"eat": "food", "tv": "entertainment", "books": "education", "laptop": "technology"}

CAT_COLORS = {
    "food": ORANGE, "entertainment": "#3B82F6", "travel": "#7C6CF0", "technology": "#1CA35A",
    "education": "#F5A623", "emi": "#E4572E", "investment": "#2EC4B6", "healthcare": "#EF476F",
    "utilities": "#118AB2", "shopping": "#9B5DE5",
}
PEER_ALIAS = {"food": "food", "entertainment": "entertainment", "technology": "technology",
              "travel": "transportation", "healthcare": "health_wellness"}


def cat_color(cat):
    return CAT_COLORS.get(cat, MUTED)


@st.cache_data
def load_student_df():
    df = pd.read_csv(STUDENT_CSV)
    if "Unnamed: 0" in df.columns:
        df = df.drop(columns=["Unnamed: 0"])
    money_cols = [c for c in EXPENSE_COLUMNS + ["monthly_income", "financial_aid"] if c in df.columns]
    for col in money_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0) * USD_TO_INR
    df["total_expenses"] = df[EXPENSE_COLUMNS].sum(axis=1)
    return df


@st.cache_data
def load_transactions_df():
    """Load the original labels plus persistent user corrections."""
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
        raise FileNotFoundError(
            "transactions.csv was not found or does not contain "
            "'transaction_text' and 'category' columns."
        )

    df = pd.concat(frames, ignore_index=True).dropna()
    df["transaction_text"] = (
        df["transaction_text"].astype(str).str.lower().str.strip()
    )
    df["category"] = (
        df["category"].astype(str).str.lower().str.strip().replace(CAT_ALIASES)
    )
    df = df[df["transaction_text"].ne("") & df["category"].ne("")]
    for amount_col in ["amount", "price", "cost"]:
        if amount_col in df.columns:
            df[amount_col] = pd.to_numeric(df[amount_col], errors="coerce").fillna(0) * USD_TO_INR
    df = df.drop_duplicates(subset=["transaction_text"], keep="last")
    return df.reset_index(drop=True)


def save_feedback(transaction_text, category):
    """Persist a correction in a dedicated rules file and training dataset."""
    text = normalize_text(transaction_text)
    category = str(category).lower().strip().replace("books", "education").replace("laptop", "technology")
    if not text or not category:
        return

    row = pd.DataFrame([{
        "transaction_text": text,
        "category": category,
    }])

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
            old = pd.read_csv(FEEDBACK_CSV)
            if {"transaction_text", "category"}.issubset(old.columns):
                train_row = pd.concat([old[["transaction_text", "category"]], train_row], ignore_index=True)
        except Exception:
            pass
    train_row = train_row.drop_duplicates(subset=["transaction_text"], keep="last")
    train_row.to_csv(FEEDBACK_CSV, index=False)
    load_transactions_df.clear()


MONTHLY_LIVING_COLUMNS = [
    "housing",
    "food",
    "transportation",
    "entertainment",
    "personal_care",
    "health_wellness",
    "miscellaneous",
]


@st.cache_resource
def train_budget_model():
    df = load_student_df().copy()
    df["monthly_living_expenses"] = df[MONTHLY_LIVING_COLUMNS].sum(axis=1)

    X = df[FEATURE_COLUMNS]
    y = df["monthly_living_expenses"]

    if len(df) < 10:
        raise ValueError("student.csv needs at least 10 rows to train the budget model.")

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
    raw_prediction = max(float(pipe.predict(row)[0]), 0.0)

    monthly_income = max(float(profile.get("monthly_income", 0)), 0.0)
    max_affordable_budget = monthly_income * 0.85

    if monthly_income > 0:
        return min(raw_prediction, max_affordable_budget)

    return raw_prediction


def normalize_text(text):
    """Normalize descriptions so learned examples can be reused reliably."""
    return " ".join(str(text).lower().strip().split())


def fit_nlp(df):
    df = df.copy()
    df["transaction_text"] = df["transaction_text"].map(normalize_text)
    df["category"] = df["category"].astype(str).str.lower().str.strip()
    df = df[df["transaction_text"].ne("") & df["category"].ne("")]

    features = FeatureUnion([
        ("word", TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
        )),
        ("char", TfidfVectorizer(
            analyzer="char_wb",
            lowercase=True,
            ngram_range=(3, 5),
            sublinear_tf=True,
            min_df=1,
        )),
    ])
    pipe = Pipeline([
        ("features", features),
        ("clf", MultinomialNB(alpha=0.15)),
    ])
    pipe.fit(df["transaction_text"], df["category"])

    memory = {}
    for text, category in zip(df["transaction_text"], df["category"]):
        memory[normalize_text(text)] = category

    # Dedicated persistent rules have the final say.
    if os.path.exists(LEARNED_CSV):
        try:
            learned = pd.read_csv(LEARNED_CSV).dropna(subset=["transaction_text", "category"])
            for text, category in zip(learned["transaction_text"], learned["category"]):
                memory[normalize_text(text)] = str(category).lower().strip()
        except Exception:
            pass

    pipe._learned_memory = memory
    return pipe


def predict_category(pipe, text):
    text = normalize_text(text)
    if not text:
        return "miscellaneous", 0.0

    # Persistent learned rules are checked FIRST. This makes a user correction
    # deterministic instead of allowing the statistical model to override it.
    rules = getattr(pipe, "_learned_memory", {})
    if text in rules:
        return rules[text], 1.0

    # Also recognize a learned phrase inside a longer description.
    text_tokens = set(text.split())
    matches = []
    for learned_text, category in rules.items():
        learned_tokens = set(learned_text.split())
        if learned_tokens and learned_tokens.issubset(text_tokens):
            matches.append((len(learned_tokens), len(learned_text), category))
    if matches:
        matches.sort(reverse=True)
        return matches[0][2], 0.99

    proba = pipe.predict_proba([text])[0]
    idx = int(np.argmax(proba))
    return pipe.classes_[idx], float(proba[idx])


# ============================================================================
# ANALYTICS + RECOMMENDATIONS  (data-returning versions of analytics.py / recommendations.py)
# ============================================================================
def peer_comparison(student_df, profile, user_expenses):
    peer_data = student_df[
        (student_df["major"] == profile["major"]) &
        (student_df["year_in_school"] == profile["year_in_school"]) &
        (student_df["age"].between(profile["age"] - 1, profile["age"] + 1))
    ]
    scope = "students like you (same major, year, similar age)"
    if len(peer_data) < 5:
        peer_data = student_df[
            (student_df["major"] == profile["major"]) &
            (student_df["year_in_school"] == profile["year_in_school"])
        ]
        scope = "students in your major & year"
    if len(peer_data) < 5:
        peer_data = student_df
        scope = "all students in the dataset"

    peer_avg = peer_data[EXPENSE_COLUMNS].mean()
    user_totals = user_expenses.groupby("category")["amount"].sum() if len(user_expenses) else pd.Series(dtype=float)

    rows = []
    for txn_cat, col in PEER_ALIAS.items():
        user_val = float(user_totals.get(txn_cat, 0))
        peer_val = float(peer_avg[col])
        rows.append({"category": txn_cat, "you": user_val, "peers": peer_val, "n_peers": len(peer_data)})
    return rows, scope, len(peer_data)


def detect_anomalies(user_expenses):
    if len(user_expenses) < 4:
        return pd.DataFrame(columns=user_expenses.columns)
    mean, std = user_expenses["amount"].mean(), user_expenses["amount"].std()
    threshold = mean + 2 * std
    return user_expenses[user_expenses["amount"] > threshold]


def savings_tip(user_expenses):
    totals = user_expenses.groupby("category")["amount"].sum() if len(user_expenses) else pd.Series(dtype=float)
    food, ent = float(totals.get("food", 0)), float(totals.get("entertainment", 0))
    shop = float(totals.get("shopping", 0))
    return (food + ent + shop) * 0.20, food, ent, shop


def generate_recommendations(profile, user_expenses, predicted_budget):
    recs = []
    total_spent = user_expenses["amount"].sum() if len(user_expenses) else 0
    totals = user_expenses.groupby("category")["amount"].sum() if len(user_expenses) else pd.Series(dtype=float)

    if total_spent > predicted_budget:
        recs.append(("⚠️", f"You've exceeded your predicted monthly budget by ₹{total_spent - predicted_budget:,.0f}."))
    elif predicted_budget and total_spent > 0.8 * predicted_budget:
        recs.append(("⚠️", "You've already used more than 80% of your predicted monthly budget."))
    else:
        recs.append(("✅", "Your spending is currently within your predicted budget."))

    if totals.get("food", 0) > 500:
        recs.append(("🍔", f"Food expenses are ₹{totals['food']:,.0f}. Consider cutting back on delivery orders."))
    if totals.get("entertainment", 0) > 300:
        recs.append(("🎬", "Entertainment spending is high — try a weekly cap."))
    if totals.get("travel", 0) > 300:
        recs.append(("🚌", "Consider a monthly transit pass to save on travel costs."))
    if totals.get("shopping", 0) > 1000:
        recs.append(("🛍️", "Shopping spend is high — delay non-essential purchases."))
    if totals.get("utilities", 0) > 500:
        recs.append(("💡", "Keep an eye on utility bills to trim monthly costs."))
    if totals.get("healthcare", 0) > 1000:
        recs.append(("🏥", "Healthcare spend is above usual — review if this was a one-off."))
    if profile["monthly_income"] < 1500:
        recs.append(("💰", "With a limited monthly income, prioritize essential expenses first."))
    if profile["financial_aid"] > 0:
        recs.append(("🎓", "Direct financial aid toward tuition and academic costs first."))
    if profile["age"] <= 21:
        recs.append(("🏦", "Start a small emergency fund now, even a little each month helps."))
    if profile["year_in_school"] in ["Junior", "Senior"]:
        recs.append(("📚", "Set aside savings for placements, internships and certifications."))
    if profile["major"] == "Computer Science":
        recs.append(("💻", "Budget for software subscriptions and cloud/learning platforms."))

    save_amt, food, ent, shop = savings_tip(user_expenses)
    if save_amt > 0:
        recs.append(("💵", f"Cutting food, shopping & entertainment by 20% could save ~₹{save_amt:,.0f}/month."))

    return recs



# ============================================================================
# GOALS — persistent goal Goalsning + AI goal-management helpers
# ============================================================================
GOAL_COLUMNS = ["id", "name", "target_amount", "saved_amount", "deadline", "priority"]


def load_goals():
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


def save_goals(df):
    df = df.copy()
    if len(df):
        df["target_amount"] = pd.to_numeric(df["target_amount"], errors="coerce").fillna(0)
        df["saved_amount"] = pd.to_numeric(df["saved_amount"], errors="coerce").fillna(0)
    df.to_csv(GOALS_CSV, index=False)


def goal_months_left(deadline):
    try:
        d = pd.to_datetime(deadline).date()
        today = date.today()
        months = (d.year - today.year) * 12 + (d.month - today.month)
        if d.day > today.day:
            months += 1
        return max(months, 1)
    except Exception:
        return 1


def goal_ai_advice(goal, expenses, profile, predicted_budget):
    target = float(goal["target_amount"])
    saved = float(goal["saved_amount"])
    remaining = max(target - saved, 0)
    months = goal_months_left(goal["deadline"])
    monthly_needed = remaining / months

    total_spent = float(expenses["amount"].sum()) if len(expenses) else 0
    monthly_income = float(profile.get("monthly_income", 0))
    available_after_budget = max(float(predicted_budget) - total_spent, 0)

    category_totals = (
        expenses.groupby("category")["amount"].sum()
        if len(expenses) else pd.Series(dtype=float)
    )

    tips = []

    if remaining <= 0:
        tips.append("🎉 Goal achieved. Keep this money separate so it is not accidentally spent.")
    else:
        tips.append(
            f"🎯 You need ₹{remaining:,.0f} more. Aim to save about "
            f"₹{monthly_needed:,.0f}/month to reach it by {goal['deadline']}."
        )

    if monthly_needed > max(monthly_income * 0.30, 1):
        tips.append(
            "⚠️ That monthly target is aggressive. Consider extending the deadline "
            "or lowering discretionary spending rather than cutting essentials."
        )
    elif available_after_budget >= monthly_needed:
        tips.append(
            f"✅ Based on your current logged spending, about ₹{available_after_budget:,.0f} "
            f"of predicted monthly budget remains, so the goal is currently achievable."
        )
    else:
        tips.append(
            f"⚠️ Your current spending leaves about ₹{available_after_budget:,.0f} "
            f"of predicted budget, below the ₹{monthly_needed:,.0f} monthly goal target."
        )

    discretionary = {
        "food": float(category_totals.get("food", 0)),
        "entertainment": float(category_totals.get("entertainment", 0)),
        "shopping": float(category_totals.get("shopping", 0)),
        "travel": float(category_totals.get("travel", 0)),
    }
    highest = max(discretionary, key=discretionary.get) if discretionary else None
    if highest and discretionary[highest] > 0:
        cut = discretionary[highest] * 0.15
        tips.append(
            f"💡 Your largest discretionary area is {highest.title()} "
            f"(₹{discretionary[highest]:,.0f}). A 15% reduction could free about "
            f"₹{cut:,.0f}/month toward this goal."
        )

    priority = str(goal.get("priority", "Medium")).lower()
    if priority == "high":
        tips.append("🔥 This is marked high priority. Move the monthly target into savings first.")
    elif priority == "low":
        tips.append("🟢 This is a lower-priority goal, so protect essential expenses before funding it.")

    return tips, monthly_needed


def goal_summary(goals, expenses, profile, predicted_budget):
    if not len(goals):
        return "Create your first goal and Penny will build a savings Goals around your real spending."

    active = goals.copy()
    active["remaining"] = (active["target_amount"] - active["saved_amount"]).clip(lower=0)
    active["months_left"] = active["deadline"].apply(goal_months_left)
    active["monthly_needed"] = active["remaining"] / active["months_left"]

    total_monthly_needed = float(active["monthly_needed"].sum())
    spent = float(expenses["amount"].sum()) if len(expenses) else 0
    budget_left = max(float(predicted_budget) - spent, 0)

    if total_monthly_needed <= budget_left:
        return (
            f"✅ Your active goals need about ₹{total_monthly_needed:,.0f}/month. "
            f"Your current logged spending leaves about ₹{budget_left:,.0f} "
            "of predicted budget, so your goals are currently on track."
        )

    shortfall = total_monthly_needed - budget_left
    return (
        f"⚠️ Your active goals need about ₹{total_monthly_needed:,.0f}/month, "
        f"but only about ₹{budget_left:,.0f} remains after logged spending. "
        f"You need to free up roughly ₹{shortfall:,.0f}/month or adjust a goal deadline."
    )


# ============================================================================
# SESSION STATE
# ============================================================================
student_df = load_student_df()

if "profile" not in st.session_state:
    st.session_state.profile = {
        "age": 22, "gender": "Female", "year_in_school": "Junior", "major": "Computer Science",
        "monthly_income": 1021 * USD_TO_INR, "financial_aid": 513 * USD_TO_INR,
        "preferred_payment_method": "Credit/Debit Card",
    }

if "transactions_df" not in st.session_state:
    st.session_state.transactions_df = load_transactions_df().copy()

if "nlp_model" not in st.session_state:
    st.session_state.nlp_model = fit_nlp(st.session_state.transactions_df)

if "expenses" not in st.session_state:
    st.session_state.expenses = pd.DataFrame(columns=["date", "description", "category", "amount"])

if "pending_expense" not in st.session_state:
    st.session_state.pending_expense = None

if "goal_amount" not in st.session_state:
    st.session_state.goal_amount = 5000
if "current_savings" not in st.session_state:
    st.session_state.current_savings = 1500

if "goals" not in st.session_state:
    st.session_state.goals = load_goals()

if "tab" not in st.session_state:
    st.session_state.tab = "Dashboard"

budget_pipe, budget_metrics = train_budget_model()
predicted_budget = predict_budget(budget_pipe, st.session_state.profile)

ALL_CATEGORIES = sorted(st.session_state.transactions_df["category"].unique().tolist())


def bar_row(label, amount_display, pct, color):
    st.markdown(f"""
    <div class="cat-row">
      <div class="cat-row-top"><span>{label}</span><span>{amount_display}</span></div>
      <div class="barbg"><div class="barfg" style="width:{pct}%; background:{color};"></div></div>
    </div>""", unsafe_allow_html=True)


# ============================================================================
# SIDEBAR — real editable profile that drives the model
# ============================================================================
with st.sidebar:
    st.markdown(f"""<div class="logo" style="margin-bottom:20px;"><img src="app/static/logo.png" style="width: 15vw"></div>""",
                unsafe_allow_html=True)
    st.markdown('<div class="label" style="margin-bottom:8px;">WORKSPACE</div>', unsafe_allow_html=True)

    nav_items = [("Overview", "🏠", "Dashboard"), ("Goals", "🎯", "Goals"),
                 ("Explore", "🔎", "Explore"), ("Expenses", "💳", "Expenses")]
    for label, icon, target in nav_items:
        if st.button(f"{icon}  {label}", key=f"nav_{label}", use_container_width=True):
            st.session_state.tab = target
            st.rerun()

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown('<div class="label">YOUR PROFILE</div>', unsafe_allow_html=True)
    p = st.session_state.profile
    p["age"] = st.slider("Age", 17, 30, int(p["age"]))
    p["gender"] = st.selectbox("Gender", sorted(student_df["gender"].unique()),
                                index=sorted(student_df["gender"].unique()).index(p["gender"]))
    p["year_in_school"] = st.selectbox("Year", sorted(student_df["year_in_school"].unique()),
                                        index=sorted(student_df["year_in_school"].unique()).index(p["year_in_school"]))
    p["major"] = st.selectbox("Major", sorted(student_df["major"].unique()),
                               index=sorted(student_df["major"].unique()).index(p["major"]))
    p["monthly_income"] = st.number_input("Monthly income (₹)", min_value=0, value=int(p["monthly_income"]), step=50)
    p["financial_aid"] = st.number_input("Financial aid (₹)", min_value=0, value=int(p["financial_aid"]), step=50)
    p["preferred_payment_method"] = st.selectbox(
        "Payment method", sorted(student_df["preferred_payment_method"].unique()),
        index=sorted(student_df["preferred_payment_method"].unique()).index(p["preferred_payment_method"]))

    st.markdown(
        f"""<div class="sub" style="margin-top:6px;">
        Budget model R² {budget_metrics['r2']:.2f} · MAE ₹{budget_metrics['mae']:.0f}
        </div>""",
        unsafe_allow_html=True,
    )

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown(f"""
    <div class="dark-card">
        <div class="label" style="color:#AAB0C0;">PREDICTED BUDGET</div>
        <div style="font-size:26px; font-weight:800; margin:6px 0;">₹{predicted_budget:,.0f}/mo</div>
        <div class="sub" style="color:#AAB0C0;">RandomForest · monthly living budget · USD → INR at ₹90/$</div>
    </div>""", unsafe_allow_html=True)

# ============================================================================
# TOP BAR
# ============================================================================
top_cols = st.columns([2.2, 1, 1, 1, 1, 1.8])
with top_cols[0]:
    st.markdown('<div class="logo"><div class="logo-icon"><img src="app/static/logo.png" style="width:105px"></div></div>', unsafe_allow_html=True)
tabs = ["Dashboard", "Goals", "Explore", "Expenses"]
for i, t in enumerate(tabs):
    with top_cols[i + 1]:
        if st.button(t, key=f"top_{t}", use_container_width=True,
                     type="primary" if st.session_state.tab == t else "secondary"):
            st.session_state.tab = t
            st.rerun()
with top_cols[5]:
    st.text_input("Search", placeholder="🔍 Search", label_visibility="collapsed")
st.markdown("<div style='margin-bottom:18px;'></div>", unsafe_allow_html=True)


# ============================================================================
# DASHBOARD
# ============================================================================
def render_dashboard():
    st.title("Overview")
    st.markdown("<div class='sub' style='font-size:15px;'>A clear view of your actual spending, realistic monthly budget and progress toward your goals.</div>",
                unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)

    exp = st.session_state.expenses
    this_month = datetime.now().strftime("%Y-%m")
    spent_this_month = exp[exp["date"].astype(str).str.startswith(this_month)]["amount"].sum() if len(exp) else 0
    runway = predicted_budget - spent_this_month
    runway_pill = ("pill-green", "on track") if runway >= 0 else ("pill-red", "over budget")

    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(f"""
        <div class="section-card">
            <div class="label">PREDICTED MONTHLY BUDGET</div>
            <div class="bignum">₹{predicted_budget:,.0f}</div>
            <div class="sub">monthly living budget from RandomForest</div>
        </div>""", unsafe_allow_html=True)
    with c2:
        st.markdown(f"""
        <div class="section-card">
            <div class="label">LOGGED THIS MONTH</div>
            <div class="bignum">₹{spent_this_month:,.0f}</div>
            <div class="sub">from {len(exp)} tracked expense(s)</div>
        </div>""", unsafe_allow_html=True)
    with c3:
        st.markdown(f"""
        <div class="section-card">
            <div class="label">REMAINING RUNWAY</div>
            <div class="bignum">₹{runway:,.0f}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="sub">budget left this month</div>
                <span class="pill {runway_pill[0]}">{runway_pill[1]}</span>
            </div>
        </div>""", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    colA, colB = st.columns([2.2, 1])
    with colA:
        st.markdown("<h3 style='margin-bottom:0;'>Spending trend</h3>", unsafe_allow_html=True)
        st.markdown("<div class='sub'>Actual logged expenses vs. recommended monthly living budget</div>", unsafe_allow_html=True)
        if len(exp):
            tmp = exp.copy()
            tmp["month"] = pd.to_datetime(tmp["date"]).dt.strftime("%Y-%m")
            monthly = tmp.groupby("month")["amount"].sum().sort_index()
            fig = go.Figure()
            fig.add_trace(go.Bar(x=monthly.index, y=monthly.values, marker_color=ORANGE, name="Actual"))
            fig.add_trace(go.Scatter(x=monthly.index, y=[predicted_budget] * len(monthly),
                                      mode="lines", line=dict(color=NAVY, dash="dot"), name="Predicted budget"))
            fig.update_layout(showlegend=True, plot_bgcolor="white", paper_bgcolor="white", height=320,
                               margin=dict(l=10, r=10, t=10, b=10),
                               yaxis=dict(showgrid=True, gridcolor="#EFEFEF", tickprefix="₹"))
            st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("Add actual expenses in **Expenses** to see your real spending trend here.")

    with colB:
        st.markdown("<h3 style='margin-bottom:0;'>Cost breakdown</h3>", unsafe_allow_html=True)
        st.markdown("<div class='sub' style='margin-bottom:14px;'>By category, all-time</div>", unsafe_allow_html=True)
        if len(exp):
            totals = exp.groupby("category")["amount"].sum().sort_values(ascending=False)
            max_amt = totals.max()
            for cat, amt in totals.items():
                bar_row(cat.title(), f"₹{amt:,.0f}", int(amt / max_amt * 100), cat_color(cat))
        else:
            st.info("No expenses logged yet.")

    st.markdown("<br>", unsafe_allow_html=True)
    recs = generate_recommendations(st.session_state.profile, exp, predicted_budget)
    top_icon, top_text = recs[0]
    b1, b2 = st.columns([4, 1])
    with b1:
        st.markdown(f"""
        <div class="banner">
            <div>
                <div style="color:{ORANGE}; font-weight:700; font-size:12px; letter-spacing:.05em;">FROM YOUR Goals</div>
                <div style="font-size:24px; font-weight:800; color:{NAVY}; margin:6px 0;">{top_icon} {top_text}</div>
                <div class="sub" style="max-width:600px;">See the Explore tab for a full breakdown of peer comparisons, anomalies and savings tips.</div>
            </div>
        </div>""", unsafe_allow_html=True)
    with b2:
        st.markdown("<br><br>", unsafe_allow_html=True)
        if st.button("View insights →", type="primary", use_container_width=True):
            st.session_state.tab = "Explore"
            st.rerun()


# ============================================================================
# Goals — add expense, auto-classified by the NLP model
# ============================================================================
def render_Goals():
    st.markdown("<h1 style='margin-bottom:0;'>Goals</h1>", unsafe_allow_html=True)
    st.markdown(
        "<div class='sub' style='font-size:15px;'>Set savings goals and let AI build a realistic Goals around your actual spending.</div>",
        unsafe_allow_html=True,
    )
    st.markdown("<br>", unsafe_allow_html=True)

    goals = st.session_state.goals
    exp = st.session_state.expenses

    # Goal creation
    c1, c2 = st.columns([1.25, 1])
    with c1:
        st.markdown("<h3 style='margin-bottom:0;'>Create a goal</h3>", unsafe_allow_html=True)
        st.markdown(
            "<div class='sub' style='margin-bottom:16px;'>Examples: MacBook, emergency fund, trip, tuition.</div>",
            unsafe_allow_html=True,
        )

        with st.form("goal_form", clear_on_submit=True):
            g1, g2 = st.columns(2)
            goal_name = g1.text_input("GOAL NAME", placeholder="e.g. MacBook")
            target = g2.number_input("TARGET AMOUNT (₹)", min_value=1, step=500)
            g3, g4 = st.columns(2)
            saved = g3.number_input("ALREADY SAVED (₹)", min_value=0, step=500)
            deadline = g4.date_input("TARGET DATE", value=date.today().replace(
                year=date.today().year + 1
            ))
            priority = st.selectbox("PRIORITY", ["High", "Medium", "Low"])
            create_goal = st.form_submit_button("🎯 Create goal", type="primary")

            if create_goal and goal_name.strip() and target > 0:
                next_id = int(goals["id"].max()) + 1 if len(goals) else 1
                new_goal = pd.DataFrame([{
                    "id": next_id,
                    "name": goal_name.strip(),
                    "target_amount": float(target),
                    "saved_amount": float(min(saved, target)),
                    "deadline": str(deadline),
                    "priority": priority,
                }])
                st.session_state.goals = pd.concat([goals, new_goal], ignore_index=True)
                save_goals(st.session_state.goals)
                st.success(f"Goal '{goal_name.strip()}' created.")
                st.rerun()

    with c2:
        st.markdown("**AI GOAL STATUS**")
        st.markdown(
            f"<div style='font-size:22px; font-weight:800; margin:8px 0;'>"
            f"{goal_summary(goals, exp, st.session_state.profile, predicted_budget)}</div>",
            unsafe_allow_html=True,
        )
        st.markdown(
            "<div class='sub' style='color:#AAB0C0;'>Advice uses your goals, logged expenses, income and predicted budget.</div>",
            unsafe_allow_html=True,
        )

    st.markdown("<br>", unsafe_allow_html=True)

    # Goal cards
    if len(goals):
        st.markdown("<h3>Your goals</h3>", unsafe_allow_html=True)

        for idx, goal in goals.reset_index(drop=True).iterrows():
            target = float(goal["target_amount"])
            saved = float(goal["saved_amount"])
            remaining = max(target - saved, 0)
            progress = min(saved / target * 100, 100) if target else 0
            months = goal_months_left(goal["deadline"])
            monthly_needed = remaining / months

            left, right = st.columns([2.1, 1])
            with left:
                st.markdown(
                    f"<div style='display:flex;justify-content:space-between;align-items:center;'>"
                    f"<h3 style='margin:0;'>{goal['name']}</h3>"
                    f"<span class='pill {'pill-red' if str(goal['priority']).lower() == 'high' else 'pill-orange'}'>"
                    f"{goal['priority']} priority</span></div>",
                    unsafe_allow_html=True,
                )
                st.markdown(
                    f"<div class='sub' style='margin-top:6px;'>₹{saved:,.0f} saved of ₹{target:,.0f} · "
                    f"target {goal['deadline']}</div>",
                    unsafe_allow_html=True,
                )
                st.markdown(
                    f"<div class='barbg' style='margin-top:14px;'>"
                    f"<div class='barfg' style='width:{progress}%; background:{GREEN};'></div></div>"
                    f"<div class='sub' style='margin-top:8px;'>{progress:.1f}% complete · "
                    f"₹{remaining:,.0f} remaining · about ₹{monthly_needed:,.0f}/month needed</div>",
                    unsafe_allow_html=True,
                )

                advice, _ = goal_ai_advice(
                    goal, exp, st.session_state.profile, predicted_budget
                )
                st.markdown("<div style='margin-top:14px;'><b>🤖 AI Goals</b></div>", unsafe_allow_html=True)
                for tip in advice:
                    st.markdown(f'<div class="rec-card">{tip}</div>', unsafe_allow_html=True)

            with right:
                st.markdown("<h4>Update goal</h4>", unsafe_allow_html=True)
                new_saved = st.number_input(
                    "Saved amount (₹)",
                    min_value=0,
                    value=int(saved),
                    step=100,
                    key=f"goal_saved_{goal['id']}",
                )
                new_target = st.number_input(
                    "Target (₹)",
                    min_value=1,
                    value=int(target),
                    step=100,
                    key=f"goal_target_{goal['id']}",
                )
                new_deadline = st.date_input(
                    "Target date",
                    value=pd.to_datetime(goal["deadline"]).date(),
                    key=f"goal_date_{goal['id']}",
                )
                if st.button("Save changes", key=f"goal_save_{goal['id']}", use_container_width=True):
                    st.session_state.goals.loc[idx, "saved_amount"] = min(new_saved, new_target)
                    st.session_state.goals.loc[idx, "target_amount"] = new_target
                    st.session_state.goals.loc[idx, "deadline"] = str(new_deadline)
                    save_goals(st.session_state.goals)
                    st.success("Goal updated.")
                    st.rerun()

                if st.button("Delete goal", key=f"goal_delete_{goal['id']}", use_container_width=True):
                    st.session_state.goals = st.session_state.goals[
                        st.session_state.goals["id"] != goal["id"]
                    ].reset_index(drop=True)
                    save_goals(st.session_state.goals)
                    st.rerun()

    else:
        st.info("No goals yet. Create one above and Penny will calculate how much you need to save each month.")

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<h3>How your actual spending affects your goals</h3>", unsafe_allow_html=True)

    spent = float(exp["amount"].sum()) if len(exp) else 0
    discretionary = sum(
        float(exp[exp["category"] == cat]["amount"].sum())
        for cat in ["food", "entertainment", "shopping", "travel"]
    ) if len(exp) else 0

    m1, m2, m3 = st.columns(3)
    with m1:
        st.markdown(f"<div class='label'>ACTUAL EXPENSES</div><div class='bignum'>₹{spent:,.0f}</div>",
                    unsafe_allow_html=True)
    with m2:
        st.markdown(f"<div class='label'>DISCRETIONARY SPEND</div><div class='bignum'>₹{discretionary:,.0f}</div>",
                    unsafe_allow_html=True)
    with m3:
        remaining_budget = max(predicted_budget - spent, 0)
        st.markdown(
            f"<div class='label'>BUDGET LEFT</div><div class='bignum'>₹{remaining_budget:,.0f}</div>",
            unsafe_allow_html=True,
        )

    if len(goals) and len(exp):
        st.markdown(
            "<div class='sub' style='margin-top:8px;'>"
            "Penny uses these real expenses to suggest where you can reduce spending and redirect money toward your goals. "
            "Actual transactions are entered on the Expenses page."
            "</div>",
            unsafe_allow_html=True,
        )


# ============================================================================
# EXPLORE — peer comparison, anomalies, savings tips, goal tracker, recs
# ============================================================================
def render_explore():
    st.title("Explore")
    st.markdown("<div class='sub' style='font-size:15px; margin-bottom:18px;'>Insights computed from your profile, peers and logged expenses.</div>",
                unsafe_allow_html=True)

    exp = st.session_state.expenses
    rows, scope, n_peers = peer_comparison(student_df, st.session_state.profile, exp)

    p1, p2 = st.columns([1.6, 1])
    with p1:
        st.markdown("<h3 style='margin-bottom:0;'>Peer comparison</h3>", unsafe_allow_html=True)
        st.markdown(f"<div class='sub' style='margin-bottom:14px;'>You vs. {scope} (n={n_peers})</div>", unsafe_allow_html=True)
        cats = [r["category"].title() for r in rows]
        you = [r["you"] for r in rows]
        peers = [r["peers"] for r in rows]
        fig = go.Figure()
        fig.add_trace(go.Bar(name="You", x=cats, y=you, marker_color=ORANGE))
        fig.add_trace(go.Bar(name="Peers avg", x=cats, y=peers, marker_color="#CFCBC2"))
        fig.update_layout(barmode="group", plot_bgcolor="white", paper_bgcolor="white", height=320,
                           margin=dict(l=10, r=10, t=10, b=10), yaxis=dict(tickprefix="₹", gridcolor="#EFEFEF"))
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    with p2:
        st.markdown("<h3 style='margin-bottom:14px;'>Savings goal</h3>", unsafe_allow_html=True)
        st.session_state.goal_amount = st.number_input("Goal amount (₹)", min_value=0,
                                                         value=int(st.session_state.goal_amount), step=100)
        st.session_state.current_savings = st.number_input("Current savings (₹)", min_value=0,
                                                             value=int(st.session_state.current_savings), step=100)
        goal = max(st.session_state.goal_amount, 1)
        progress = min(st.session_state.current_savings / goal * 100, 100)
        st.markdown(f"""
        <div class="barbg" style="margin-top:10px;"><div class="barfg" style="width:{progress}%; background:{GREEN};"></div></div>
        <div class="sub" style="margin-top:8px;">{progress:.1f}% of goal reached</div>
        """, unsafe_allow_html=True)
        if progress >= 100:
            st.success("🎉 Goal achieved!")
        else:
            st.caption(f"₹{goal - st.session_state.current_savings:,.0f} remaining")

    st.markdown("<br>", unsafe_allow_html=True)
    a1, a2 = st.columns([1, 1])
    with a1:
        st.markdown("<h3 style='margin-bottom:0;'>Anomaly detection</h3>", unsafe_allow_html=True)
        st.markdown("<div class='sub' style='margin-bottom:14px;'>Unusually large transactions (mean + 2σ)</div>", unsafe_allow_html=True)
        anomalies = detect_anomalies(exp)
        if len(anomalies):
            for _, row in anomalies.iterrows():
                st.markdown(f"""<div class="rec-card">⚠️ <b>{row['description']}</b> — ₹{row['amount']:,.0f} on {row['date']} ({row['category'].title()})</div>""",
                            unsafe_allow_html=True)
        else:
            st.info("No anomalies detected yet — log a few more expenses.")

    with a2:
        st.markdown("<h3 style='margin-bottom:0;'>Savings tip</h3>", unsafe_allow_html=True)
        st.markdown("<div class='sub' style='margin-bottom:14px;'>Cutting discretionary spend by 20%</div>", unsafe_allow_html=True)
        save_amt, food, ent, shop = savings_tip(exp)
        st.markdown(f"""
        <div class="bignum" style="font-size:28px;">₹{save_amt:,.0f}/mo</div>
        <div class="sub">Food ₹{food:,.0f} · Entertainment ₹{ent:,.0f} · Shopping ₹{shop:,.0f}</div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<h3 style='margin-bottom:14px;'>AI recommendations</h3>", unsafe_allow_html=True)
    for icon, text in generate_recommendations(st.session_state.profile, exp, predicted_budget):
        st.markdown(f'<div class="rec-card">{icon} {text}</div>', unsafe_allow_html=True)


# ============================================================================
# EXPENSES — editable ledger + retrain classifier
# ============================================================================
def render_expenses():
    st.markdown("<h1 style='margin-bottom:0;'>Actual expenses</h1>", unsafe_allow_html=True)
    st.markdown(
        "<div class='sub' style='font-size:15px; margin-bottom:18px;'>"
        "Record what you actually spent. AI categorizes transactions and learns from your corrections."
        "</div>",
        unsafe_allow_html=True,
    )

    # Add actual expense
    st.markdown("<h3 style='margin-bottom:0;'>Add an actual expense</h3>", unsafe_allow_html=True)
    st.markdown(
        "<div class='sub' style='margin-bottom:16px;'>Describe the purchase and Penny will suggest a category.</div>",
        unsafe_allow_html=True,
    )

    with st.form("expense_form", clear_on_submit=True):
        e1, e2, e3 = st.columns(3)
        desc = e1.text_input("DESCRIPTION", placeholder="e.g. MacBook purchase")
        amount = e2.number_input("AMOUNT (₹)", min_value=0, step=50)
        when = e3.date_input("DATE", value=date.today())
        add_expense = st.form_submit_button("Add actual expense", type="primary")

        if add_expense and desc.strip() and amount > 0:
            cat, conf = predict_category(st.session_state.nlp_model, desc)
            st.session_state.pending_expense = {
                "date": str(when),
                "description": desc.strip(),
                "amount": amount,
                "predicted_category": cat,
                "confidence": conf,
            }

    pe = st.session_state.pending_expense
    if pe:
        conf_pct = int(pe["confidence"] * 100)
        pill_class = "pill-green" if pe["confidence"] >= 0.6 else "pill-red"
        st.markdown(
            f"""
            <div style="background:#FAF8F4; border-radius:14px; padding:16px 18px; margin-top:10px;">
                <div class="sub">"{pe['description']}" → ₹{pe['amount']:,.0f}</div>
                <div style="margin-top:6px; font-weight:700; font-size:17px; color:{NAVY};">
                    AI category: {pe['predicted_category'].title()}
                    <span class="pill {pill_class}" style="margin-left:8px;">{conf_pct}% confidence</span>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        ec1, ec2, ec3 = st.columns([1, 1.4, 1])
        if ec1.button("✅ Add as predicted", use_container_width=True, type="primary"):
            st.session_state.expenses = pd.concat(
                [
                    pd.DataFrame([{
                        "date": pe["date"],
                        "description": pe["description"],
                        "category": pe["predicted_category"],
                        "amount": pe["amount"],
                    }]),
                    st.session_state.expenses,
                ],
                ignore_index=True,
            )
            st.session_state.pending_expense = None
            st.rerun()

        override_cat = ec2.selectbox(
            "Correct category",
            ALL_CATEGORIES,
            index=ALL_CATEGORIES.index(pe["predicted_category"])
            if pe["predicted_category"] in ALL_CATEGORIES else 0,
            label_visibility="collapsed",
        )

        if ec3.button("Teach AI + add", use_container_width=True):
            st.session_state.expenses = pd.concat(
                [
                    pd.DataFrame([{
                        "date": pe["date"],
                        "description": pe["description"],
                        "category": override_cat,
                        "amount": pe["amount"],
                    }]),
                    st.session_state.expenses,
                ],
                ignore_index=True,
            )

            save_feedback(pe["description"], override_cat)
            st.session_state.transactions_df = load_transactions_df().copy()
            st.session_state.nlp_model = fit_nlp(st.session_state.transactions_df)

            learned_cat, _ = predict_category(
                st.session_state.nlp_model, pe["description"]
            )
            st.session_state.pending_expense = None
            st.success(
                f"AI learned: '{pe['description']}' → {learned_cat.title()}."
            )
            st.rerun()

    st.markdown("<br>", unsafe_allow_html=True)

    # Actual expense ledger
    st.markdown("<h3>Actual expense ledger</h3>", unsafe_allow_html=True)

    edited = st.data_editor(
        st.session_state.expenses,
        use_container_width=True,
        hide_index=True,
        num_rows="dynamic",
        column_config={
            "amount": st.column_config.NumberColumn("Amount (₹)", format="₹%d"),
            "category": st.column_config.SelectboxColumn(
                "Category", options=ALL_CATEGORIES
            ),
        },
    )
    st.session_state.expenses = edited

    st.markdown("<br>", unsafe_allow_html=True)
    c1, c2 = st.columns([1, 2])

    with c1:
        st.download_button(
            "⬇ Export actual expenses",
            edited.to_csv(index=False),
            "expenses.csv",
            "text/csv",
            use_container_width=True,
        )

    with c2:
        if st.button(
            "🔁 Save corrections & retrain AI",
            use_container_width=True,
        ):
            if len(edited):
                for _, row in edited.dropna(
                    subset=["description", "category"]
                ).iterrows():
                    save_feedback(row["description"], row["category"])

            st.session_state.transactions_df = load_transactions_df().copy()
            st.session_state.nlp_model = fit_nlp(
                st.session_state.transactions_df
            )
            st.success(
                f"AI retrained using {len(st.session_state.transactions_df):,} "
                "labeled examples."
            )


# ============================================================================
# ROUTER
# ============================================================================
if st.session_state.tab == "Dashboard":
    render_dashboard()
elif st.session_state.tab == "Goals":
    render_Goals()
elif st.session_state.tab == "Explore":
    render_explore()
elif st.session_state.tab == "Expenses":
    render_expenses()