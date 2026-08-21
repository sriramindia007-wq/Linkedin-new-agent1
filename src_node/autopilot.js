const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "data", "autopilot_config.json");
const postsPath = path.join(__dirname, "..", "data", "posts.json");

function loadAutopilotConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {}
  return {
    enabled: false,
    mode: "SEMI_AUTOPILOT",
    min_score_threshold: 92,
    max_daily_comments: 4,
    daily_comments_posted_today: 0,
    human_jitter_min_seconds: 180,
    human_jitter_max_seconds: 480
  };
}

function saveAutopilotConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("Error saving autopilot config:", e);
    return false;
  }
}

// Background Engagement Evaluator
async function runAutopilotEngagementCycle(safeRequire) {
  const config = loadAutopilotConfig();
  if (!config.enabled) {
    return { status: "IDLE", message: "Autopilot is turned OFF." };
  }

  if (config.daily_comments_posted_today >= config.max_daily_comments) {
    console.log(`⏸️ [AUTOPILOT] Reached maximum daily safety limit (${config.max_daily_comments} comments/day). Pausing until tomorrow.`);
    return { status: "RATE_LIMITED", message: "Daily limit reached for organic safety." };
  }

  console.log(`🤖 [AUTOPILOT ENGINE] Running autonomous engagement evaluation...`);

  const db = safeRequire("db");
  const posts = db.loadPosts();
  const pendingPosts = posts.filter(p => p.status === "PENDING" && (p.priority_score || 0) >= config.min_score_threshold);

  if (!pendingPosts.length) {
    console.log(`[AUTOPILOT] No pending posts meeting min score threshold (${config.min_score_threshold}/100).`);
    return { status: "NO_QUALIFYING_POSTS", count: 0 };
  }

  // Pick the highest scoring post
  pendingPosts.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  const targetPost = pendingPosts[0];

  const commentText = targetPost.generated_comments?.value_add || 
                      targetPost.generated_comments?.provocative_question || 
                      targetPost.generated_comments?.executive_perspective;

  if (!commentText) {
    return { status: "NO_COMMENT_GENERATED" };
  }

  // Calculate random human jitter (3 to 8 minutes)
  const jitterSec = Math.floor(Math.random() * (config.human_jitter_max_seconds - config.human_jitter_min_seconds + 1)) + config.human_jitter_min_seconds;
  console.log(`🕒 [AUTOPILOT] Selected Top Post: "${targetPost.author_name}". Applying ${jitterSec}s human-like jitter delay before engagement...`);

  if (config.mode === "FULL_AUTOPILOT") {
    // Approve and post with delay
    setTimeout(async () => {
      try {
        db.approveComment(targetPost.id, "value_add", commentText);
        const poster = safeRequire("poster");
        await poster.postCommentToLinkedIn(targetPost.id);
        
        config.daily_comments_posted_today += 1;
        config.last_run_timestamp = new Date().toISOString();
        saveAutopilotConfig(config);
        
        console.log(`🚀 [AUTOPILOT SUCCESS] Automatically posted high-impact comment on ${targetPost.author_name}'s post!`);
      } catch (err) {
        console.error(`❌ [AUTOPILOT ERROR] Failed to post:`, err.message);
      }
    }, jitterSec * 1000);

    return { 
      status: "QUEUED_WITH_JITTER", 
      postId: targetPost.id, 
      targetAuthor: targetPost.author_name, 
      delaySeconds: jitterSec 
    };
  }

  return { status: "SEMI_AUTOPILOT_READY", targetPost };
}

module.exports = {
  loadAutopilotConfig,
  saveAutopilotConfig,
  runAutopilotEngagementCycle
};
