import os
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSACTIONS_CSV = os.path.join(BASE_DIR, "transactions.csv")
FEEDBACK_CSV = os.path.join(BASE_DIR, "transaction_feedback.csv")
CAT_ALIASES = {"eat": "food", "tv": "entertainment", "books": "education", "laptop": "technology"}

def normalize_text(text):
    return " ".join(str(text).lower().strip().split())

def load_data():
    frames = []
    if os.path.exists(TRANSACTIONS_CSV):
        frames.append(pd.read_csv(TRANSACTIONS_CSV)[["transaction_text", "category"]])
    if os.path.exists(FEEDBACK_CSV):
        frames.append(pd.read_csv(FEEDBACK_CSV)[["transaction_text", "category"]])
    
    df = pd.concat(frames, ignore_index=True).dropna()
    df["transaction_text"] = df["transaction_text"].map(normalize_text)
    df["category"] = df["category"].astype(str).str.lower().str.strip().replace(CAT_ALIASES)
    df = df[df["transaction_text"].ne("") & df["category"].ne("")]
    df = df.drop_duplicates(subset=["transaction_text"], keep="last").reset_index(drop=True)
    return df

def evaluate_model():
    df = load_data()
    
    X_train, X_test, y_train, y_test = train_test_split(
        df["transaction_text"], df["category"], test_size=0.2, random_state=42
    )

    features = FeatureUnion([
        ("word", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
        ("char", TfidfVectorizer(analyzer="char_wb", lowercase=True, ngram_range=(3, 5), sublinear_tf=True, min_df=1)),
    ])
    
    pipe = Pipeline([
        ("features", features),
        ("clf", MultinomialNB(alpha=0.15)),
    ])

    pipe.fit(X_train, y_train)

    y_pred = pipe.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted')

    print("=== NLP Model Evaluation Metrics ===")
    print(f"Accuracy:  {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"Precision: {precision:.4f} ({precision*100:.2f}%)")
    print(f"Recall:    {recall:.4f} ({recall*100:.2f}%)")
    print(f"F1 Score:  {f1:.4f} ({f1*100:.2f}%)")
    print("\n=== Detailed Classification Report ===")
    print(classification_report(y_test, y_pred))

if __name__ == "__main__":
    evaluate_model()