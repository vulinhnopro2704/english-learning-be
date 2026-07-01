import os
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Ensure the output directory exists
output_dir = os.path.dirname(os.path.abspath(__file__))
os.makedirs(output_dir, exist_ok=True)

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

# FSRS Constants
FACTOR = 19.0 / 81.0
DECAY = -0.5

def retrievability(t, S):
    """FSRS Retrievability formula: R(t, S) = (1 + FACTOR * t / S) ^ DECAY"""
    return (1.0 + FACTOR * (t / S)) ** DECAY

# ----------------------------------------------------
# Chart 1: Memory Decay Curves for different Stabilities
# ----------------------------------------------------
def plot_decay_curves():
    plt.figure(figsize=(8, 5))
    t = np.linspace(0, 50, 500)
    stabilities = [1, 3, 10, 30]
    
    # Custom palette
    colors = sns.color_palette("viridis", len(stabilities))
    
    for S, color in zip(stabilities, colors):
        R = retrievability(t, S)
        plt.plot(t, R * 100, label=f"S = {S} ngày", color=color, linewidth=2.5)
        
    # Draw 90% Target Retention threshold
    plt.axhline(y=90, color="crimson", linestyle="--", linewidth=1.5, alpha=0.8, label="Target Retention (90%)")
    
    # Highlight 90% intersection points
    for S in stabilities:
        # For R = 0.9, t = S (by definition of Stability in FSRS)
        # Verify: R(S, S) = (1 + 19/81)^(-0.5) = (100/81)^(-0.5) = 9/10 = 0.9. Correct!
        plt.plot(S, 90, 'o', color="crimson", markersize=6)
        plt.annotate(f"{S}d", (S, 90), textcoords="offset points", xytext=(0,-15), ha='center', fontsize=9, fontweight='bold', color="crimson")

    plt.title("Đường cong quên lãng FSRS theo các mức độ ổn định (Stability - S)", pad=15, fontweight='bold')
    plt.xlabel("Thời gian trôi qua (Ngày)", labelpad=10)
    plt.ylabel("Khả năng nhớ lại - Retrievability (R, %)", labelpad=10)
    plt.ylim(30, 105)
    plt.xlim(0, 50)
    plt.legend(loc="lower left", frameon=True, facecolor="white", edgecolor="none")
    plt.tight_layout()
    
    path = os.path.join(output_dir, "fsrs-forgetting-curve.png")
    plt.savefig(path, dpi=300)
    plt.close()
    print(f"Saved Chart 1 to {path}")

# ----------------------------------------------------
# Chart 2: Spaced Repetition Memory Consolidation
# ----------------------------------------------------
def plot_memory_consolidation():
    plt.figure(figsize=(10, 5.5))
    
    # Timeline simulation
    # S0 = 1.0, review at t=1 -> S1 = 3.5, review at t=1+3.5=4.5 -> S2 = 10.0, review at t=4.5+10=14.5 -> S3 = 26.0
    reviews = [
        {"start_time": 0.0, "duration": 1.0, "S": 1.0, "label": "Lần 1 (S=1.0)"},
        {"start_time": 1.0, "duration": 3.5, "S": 3.5, "label": "Lần 2 (S=3.5)"},
        {"start_time": 4.5, "duration": 10.0, "S": 10.0, "label": "Lần 3 (S=10.0)"},
        {"start_time": 14.5, "duration": 25.0, "S": 25.0, "label": "Lần 4 (S=25.0)"}
    ]
    
    colors = sns.color_palette("crest", len(reviews))
    
    total_t = []
    total_R = []
    
    for i, rev in enumerate(reviews):
        t_local = np.linspace(0, rev["duration"], 200)
        t_global = rev["start_time"] + t_local
        R = retrievability(t_local, rev["S"])
        
        plt.plot(t_global, R * 100, color=colors[i], linewidth=2.5)
        # Shade under the curve
        plt.fill_between(t_global, R * 100, 30, color=colors[i], alpha=0.08)
        
        # Draw vertical lines at review points
        if i > 0:
            plt.axvline(x=rev["start_time"], color="gray", linestyle=":", linewidth=1, alpha=0.7)
            plt.plot(rev["start_time"], 100, '^', color="green", markersize=8)
            plt.annotate("Ôn tập\n(Good)", (rev["start_time"], 100), textcoords="offset points", 
                         xytext=(0, 10), ha='center', fontsize=9, color="green", fontweight="bold")
            
    # Target retention threshold line
    plt.axhline(y=90, color="crimson", linestyle="--", linewidth=1.5, alpha=0.6)
    plt.text(40, 92, "Target Retention (90%)", color="crimson", fontsize=10, ha="right")

    plt.title("Hiệu ứng giãn cách: Củng cố trí nhớ qua các chu kỳ ôn tập", pad=15, fontweight='bold')
    plt.xlabel("Tổng số ngày học", labelpad=10)
    plt.ylabel("Khả năng nhớ lại - Retrievability (R, %)", labelpad=10)
    plt.ylim(30, 115)
    plt.xlim(0, 40)
    
    # Custom legends for stability phases
    from matplotlib.lines import Line2D
    legend_elements = [Line2D([0], [0], color=colors[i], lw=2.5, label=f"Chu kỳ {i+1} (S = {rev['S']} ngày)") for i, rev in enumerate(reviews)]
    plt.legend(handles=legend_elements, loc="lower left")
    
    plt.tight_layout()
    path = os.path.join(output_dir, "fsrs-memory-consolidation.png")
    plt.savefig(path, dpi=300)
    plt.close()
    print(f"Saved Chart 2 to {path}")

# ----------------------------------------------------
# Chart 3: Stability Growth Factor vs. Retrievability (R) at Review Time
# ----------------------------------------------------
def plot_stability_growth():
    plt.figure(figsize=(8.5, 5))
    
    # Stability Growth formula in FSRS v4/v5/v6:
    # S'_r = S * (1 + e^w8 * (11 - D) * S^-w9 * (e^(w10 * (1-R)) - 1) * G_factor)
    # Let's plot Growth Factor = S'_r / S = 1 + constant * (e^(w10 * (1-R)) - 1)
    # Let's assume typical weights: w8 = 1.0, w9 = 0.15, w10 = 1.5, D = 4.0, S = 5.0
    w8 = 0.8
    w9 = 0.15
    w10 = 1.6
    D = 4.0
    S = 5.0
    
    R = np.linspace(0.1, 0.98, 200)
    
    # Grades: Hard (multiplier = 0.6), Good (multiplier = 1.0), Easy (multiplier = 1.4)
    grades = [
        {"label": "Easy (Dễ)", "mult": 1.4, "color": "#2ca02c"},
        {"label": "Good (Tốt)", "mult": 1.0, "color": "#1f77b4"},
        {"label": "Hard (Khó)", "mult": 0.6, "color": "#ff7f0e"}
    ]
    
    for g in grades:
        # Growth factor calculations
        factor = 1.0 + np.exp(w8) * (11.0 - D) * (S ** -w9) * (np.exp(w10 * (1.0 - R)) - 1.0) * g["mult"]
        plt.plot(R * 100, factor, label=g["label"], color=g["color"], linewidth=2.5)

    plt.title("Hệ số tăng trưởng độ ổn định (S'/S) theo khả năng nhớ lại (R) tại thời điểm ôn tập", pad=15, fontweight='bold', fontsize=12)
    plt.xlabel("Khả năng nhớ lại tại lúc ôn tập - Retrievability (R, %)", labelpad=10)
    plt.ylabel("Hệ số tăng trưởng ổn định (S' / S)", labelpad=10)
    plt.xlim(10, 100)
    
    # Highlight Spacing Effect
    plt.annotate("Hiệu ứng giãn cách:\nÔn tập khi gần quên (R thấp)\ngiúp trí nhớ tăng trưởng mạnh nhất!", 
                 xy=(20, 4.0), xytext=(40, 5.0),
                 arrowprops=dict(facecolor='black', shrink=0.08, width=1.5, headwidth=6),
                 fontsize=10, bbox=dict(boxstyle="round,pad=0.5", fc="yellow", alpha=0.2))

    plt.legend(loc="upper right")
    plt.tight_layout()
    path = os.path.join(output_dir, "fsrs-spacing-effect.png")
    plt.savefig(path, dpi=300)
    plt.close()
    print(f"Saved Chart 3 to {path}")

# ----------------------------------------------------
# Chart 4: Interval Growth for Easy vs. Hard Card
# ----------------------------------------------------
def plot_interval_growth():
    plt.figure(figsize=(8.5, 5))
    
    # We simulate 6 reviews with all "Good" ratings.
    # Easy card: D starts at 2.0. Memory stability grows fast.
    # Hard card: D starts at 8.0. Memory stability grows slow.
    
    # Simple simulation matching FSRS growth:
    # S_new = S_old * (1 + growth_factor)
    # For Easy: growth factor around 3.5 -> S_new ~ S_old * 4.5
    # For Hard: growth factor around 1.2 -> S_new ~ S_old * 2.2
    
    reps = np.arange(1, 7)
    
    # We will compute intervals for target retention 90% (which equals S)
    # Start stability S0 = 1.0 day for both
    easy_intervals = [1.0]
    hard_intervals = [1.0]
    
    # Simulate step-by-step
    # Easy (D=2): growth multiplier is large
    # Hard (D=8): growth multiplier is small
    for i in range(1, 6):
        # S_i = S_{i-1} * Growth
        # Growth is also slightly decreasing as S increases (due to S^-w9)
        easy_growth = 3.8 * (easy_intervals[-1] ** -0.15)
        hard_growth = 1.5 * (hard_intervals[-1] ** -0.15)
        
        easy_intervals.append(easy_intervals[-1] * (1.0 + easy_growth))
        hard_intervals.append(hard_intervals[-1] * (1.0 + hard_growth))
        
    plt.plot(reps, easy_intervals, 'o-', color="#2ca02c", linewidth=2.5, markersize=8, label="Từ vựng Dễ (Difficulty D = 2)")
    plt.plot(reps, hard_intervals, 's-', color="#d62728", linewidth=2.5, markersize=8, label="Từ vựng Khó (Difficulty D = 8)")
    
    # Add values on top of the points
    for x, y in zip(reps, easy_intervals):
        plt.annotate(f"{y:.1f}d", (x, y), textcoords="offset points", xytext=(0,10), ha='center', fontsize=9, fontweight='bold', color="#2ca02c")
    for x, y in zip(reps, hard_intervals):
        plt.annotate(f"{y:.1f}d", (x, y), textcoords="offset points", xytext=(0,-15), ha='center', fontsize=9, fontweight='bold', color="#d62728")

    plt.title("So sánh tăng trưởng khoảng cách ôn tập (Interval) giữa Từ vựng Dễ vs Khó", pad=15, fontweight='bold')
    plt.xlabel("Lần ôn tập thứ (tất cả đánh giá 'Good')", labelpad=10)
    plt.ylabel("Khoảng cách ôn tập tiếp theo (Ngày)", labelpad=10)
    plt.xticks(reps)
    plt.yscale("log")  # Use log scale since growth is exponential
    plt.ylim(0.5, 300)
    
    # Custom y-ticks for clarity in log scale
    plt.yticks([1, 2, 5, 10, 20, 50, 100, 200], ["1 ngày", "2 ngày", "5 ngày", "10 ngày", "20 ngày", "50 ngày", "100 ngày", "200 ngày"])
    
    plt.legend(loc="upper left")
    plt.tight_layout()
    path = os.path.join(output_dir, "fsrs-difficulty-comparison.png")
    plt.savefig(path, dpi=300)
    plt.close()
    print(f"Saved Chart 4 to {path}")

if __name__ == "__main__":
    plot_decay_curves()
    plot_memory_consolidation()
    plot_stability_growth()
    plot_interval_growth()
    print("All FSRS charts generated successfully!")
