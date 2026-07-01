import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Path configuration
output_dir = os.path.dirname(os.path.abspath(__file__))

# Set professional plotting style
sns.set_theme(style="whitegrid", context="talk")
plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.sans-serif': ['DejaVu Sans', 'Arial', 'Helvetica'],
    'figure.titlesize': 16,
    'axes.titlesize': 14,
    'axes.labelsize': 12,
    'xtick.labelsize': 11,
    'ytick.labelsize': 11,
    'legend.fontsize': 11,
    'figure.dpi': 300
})

def fetch_data_from_db(db_url):
    """
    Connects to PostgreSQL database and retrieves FSRS review logs.
    Query matches the schema used in the learn / fsrs-ai microservices.
    """
    try:
        import psycopg2
        print(f"Connecting to database to fetch real user logs...")
        conn = psycopg2.connect(db_url)
        
        # Query logs from review_logs table (FSRS-AI Service)
        # We need the predicted retrievability (R) at review time and the actual result (grade)
        # In FSRS-AI, review_logs table has columns:
        # - grade: 1 (Again/Forgot), 2 (Hard), 3 (Good), 4 (Easy)
        # - retrievability: predicted R before review
        query = """
            SELECT 
                r.retrievability as predicted_r,
                r.grade as grade
            FROM review_logs r
            WHERE r.retrievability IS NOT NULL AND r.grade IS NOT NULL;
        """
        df = pd.read_sql_query(query, conn)
        conn.close()
        print(f"Successfully fetched {len(df)} logs from database.")
        return df
    except Exception as e:
        print(f"Database connection error: {e}", file=sys.stderr)
        print("Falling back to generating realistic mock user data for demonstration...", file=sys.stderr)
        return None

def generate_mock_user_logs(num_logs=800):
    """
    Generates realistic mock user logs for FSRS calibration demonstration.
    Models a user whose actual retention closely tracks FSRS predictions (with some noise).
    """
    np.random.seed(42)
    # Generate predicted retrievability centered around 70%-95% (common review times)
    predicted_r = np.random.beta(a=5, b=2, size=num_logs) 
    
    # Simulate actual recall (1 for Success: Grade >= 2, 0 for Forgot: Grade == 1)
    # Probability of success is equal to predicted R + some small variance
    actual_recall = []
    for r in predicted_r:
        # FSRS prediction tells us the probability of recall is exactly R
        success = np.random.binomial(1, r)
        actual_recall.append(success)
        
    df = pd.DataFrame({
        'predicted_r': predicted_r,
        'grade': [3 if s == 1 else 1 for s in actual_recall]  # 3 is Good, 1 is Again
    })
    return df

def plot_calibration_curve(df, is_mock=True):
    # Convert grade to binary recall (1 = Remembered, 0 = Forgot)
    # FSRS mapping: Grade 1 (Again) = 0, Grade 2-4 (Hard, Good, Easy) = 1
    df['recalled'] = (df['grade'] >= 2).astype(int)
    
    # Bin predicted retrievability into 10 intervals from 0 to 1
    bins = np.linspace(0, 1.0, 11)
    df['bin'] = pd.cut(df['predicted_r'], bins=bins, labels=False, include_lowest=True)
    
    # Calculate average predicted retrievability and actual recall rate for each bin
    bin_stats = df.groupby('bin').agg(
        avg_predicted=('predicted_r', 'mean'),
        actual_retention=('recalled', 'mean'),
        count=('recalled', 'count')
    ).reset_index()
    
    # Filter out bins with very few records to avoid noise
    bin_stats = bin_stats[bin_stats['count'] >= 5]
    
    # Compute Calibration Error (RMSE)
    # Weigh by count to give more importance to bins with more data
    weighted_diff = (bin_stats['avg_predicted'] - bin_stats['actual_retention']) ** 2 * bin_stats['count']
    rmse_calibration = np.sqrt(weighted_diff.sum() / bin_stats['count'].sum())
    
    plt.figure(figsize=(8, 6.5))
    
    # Plot perfect calibration diagonal line (y = x)
    plt.plot([0, 1], [0, 1], color='gray', linestyle='--', linewidth=1.5, label='Lý thuyết (Perfect Calibration)')
    
    # Plot user actual calibration curve
    color = "#1f77b4" if not is_mock else "#17becf"
    plt.plot(bin_stats['avg_predicted'], bin_stats['actual_retention'], 'o-', 
             color=color, linewidth=2.5, markersize=8, label='Dữ liệu thực tế của User')
    
    # Add count labels for each point
    for idx, row in bin_stats.iterrows():
        plt.annotate(f"N={int(row['count'])}", 
                     (row['avg_predicted'], row['actual_retention']), 
                     textcoords="offset points", 
                     xytext=(0, 10), ha='center', fontsize=8, color="#555")
        
    title_prefix = "[GIẢ LẬP]" if is_mock else "[THỰC TẾ]"
    plt.title(f"{title_prefix} Đồ thị Hiệu chuẩn FSRS (Calibration Curve)\nĐo lường độ chính xác của dự đoán trí nhớ", 
              pad=15, fontweight='bold', fontsize=12)
    plt.xlabel("Khả năng nhớ lại dự đoán bởi FSRS (Predicted Retrievability - R)", labelpad=10)
    plt.ylabel("Tỷ lệ nhớ lại thực tế của User (Actual Recall Rate)", labelpad=10)
    
    plt.xlim(0.4, 1.0) # Zoom into the relevant range for spaced repetition
    plt.ylim(0.4, 1.0)
    
    # Subtitle with calibration error
    plt.text(0.42, 0.45, f"Calibration RMSE: {rmse_calibration:.4f}\n(Càng nhỏ càng tốt, lý tưởng < 0.05)", 
             fontsize=10, bbox=dict(boxstyle="round,pad=0.5", fc="white", ec="gray", alpha=0.9))
    
    plt.legend(loc="upper left")
    plt.tight_layout()
    
    path = os.path.join(output_dir, "fsrs-user-calibration.png")
    plt.savefig(path, dpi=300)
    plt.close()
    print(f"Saved Calibration Chart to {path}")
    return path

if __name__ == "__main__":
    db_url = os.environ.get("DATABASE_URL")
    is_mock = True
    
    if db_url:
        df = fetch_data_from_db(db_url)
        if df is not None:
            is_mock = False
    
    if is_mock:
        df = generate_mock_user_logs()
        
    plot_calibration_curve(df, is_mock)
    print("Execution complete.")
