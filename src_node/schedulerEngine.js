const fs = require('fs');
const path = require('path');

const SCHEDULE_FILE = path.join(__dirname, 'data', 'scheduled_posts.json');

function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadScheduledPosts() {
  ensureDataDir();
  if (!fs.existsSync(SCHEDULE_FILE)) return [];
  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveScheduledPosts(posts) {
  ensureDataDir();
  try {
    fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(posts, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Scheduler] Error saving scheduled posts:', e.message);
  }
}

function schedulePost({ postId, postType = 'POST', postText, sourceLink = '', publisher = '', authorName = '', sourceCategory = '', scheduledTime }) {
  if (!postText || !scheduledTime) {
    throw new Error('Missing post content or scheduled time');
  }

  const posts = loadScheduledPosts();
  const scheduleId = 'sched_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  
  const newItem = {
    id: scheduleId,
    original_id: postId,
    post_type: postType,
    author_name: authorName || 'Sriram Ganesan',
    source_category: sourceCategory || 'Digital Lending & Fintech',
    post_text: postText.trim(),
    source_link: sourceLink ? sourceLink.trim() : '',
    publisher: publisher || 'Financial Media',
    scheduled_time: new Date(scheduledTime).toISOString(),
    created_at: new Date().toISOString(),
    status: 'SCHEDULED'
  };

  posts.push(newItem);
  saveScheduledPosts(posts);

  // Update status in original database
  try {
    if (postType === 'NEWS') {
      const { loadMarketNews, saveMarketNews } = require('./externalNewsEngine');
      const news = loadMarketNews ? loadMarketNews() : [];
      const item = news.find(n => n.id === postId);
      if (item) {
        item.status = 'SCHEDULED';
        item.scheduled_time = newItem.scheduled_time;
        saveMarketNews(news);
      }
    } else {
      const { loadPosts, savePosts, recordPersistedAction } = require('./db');
      const allPosts = loadPosts ? loadPosts() : [];
      const p = allPosts.find(item => item.id === postId);
      if (p) {
        p.status = 'SCHEDULED';
        p.scheduled_time = newItem.scheduled_time;
        savePosts(allPosts);
        if (recordPersistedAction) {
          recordPersistedAction(p, { status: 'SCHEDULED', scheduled_time: newItem.scheduled_time });
        }
      }
    }
  } catch (e) {
    console.warn('[Scheduler] Note updating original item:', e.message);
  }

  console.log('⏰ [Scheduler] Post scheduled for ' + new Date(newItem.scheduled_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
  return newItem;
}

function cancelScheduledPost(scheduleId) {
  const posts = loadScheduledPosts();
  const item = posts.find(p => p.id === scheduleId);
  if (!item) return false;

  item.status = 'CANCELLED';
  saveScheduledPosts(posts);

  // Restore original item to PENDING
  try {
    if (item.post_type === 'NEWS') {
      const { loadMarketNews, saveMarketNews } = require('./externalNewsEngine');
      const news = loadMarketNews ? loadMarketNews() : [];
      const orig = news.find(n => n.id === item.original_id);
      if (orig) {
        orig.status = 'PENDING';
        delete orig.scheduled_time;
        saveMarketNews(news);
      }
    } else {
      const { loadPosts, savePosts, recordPersistedAction } = require('./db');
      const allPosts = loadPosts ? loadPosts() : [];
      const p = allPosts.find(p => p.id === item.original_id);
      if (p) {
        p.status = 'PENDING';
        delete p.scheduled_time;
        savePosts(allPosts);
        if (recordPersistedAction) {
          recordPersistedAction(p, { status: 'PENDING' });
        }
      }
    }
  } catch (e) {}

  return true;
}

async function runDueScheduledPosts() {
  const posts = loadScheduledPosts();
  const now = new Date();
  let updated = false;

  for (const item of posts) {
    if (item.status === 'SCHEDULED' && new Date(item.scheduled_time) <= now) {
      console.log('⏰ [Scheduler Worker] Executing scheduled post "' + item.id + '" (Target: ' + item.scheduled_time + ')...');
      
      try {
        const { publishStandalonePostToLinkedIn } = require('./poster');
        const result = await publishStandalonePostToLinkedIn(item.post_text, item.source_link, item.publisher);
        
        if (result && result.success) {
          item.status = 'EXECUTED';
          item.executed_at = new Date().toISOString();
          updated = true;

          const { markPostAsManuallyPosted } = require('./db');
          if (markPostAsManuallyPosted) {
            markPostAsManuallyPosted(item.original_id || item.id, item.post_text, 'Scheduled Auto-Post');
          }
          console.log('✅ [Scheduler Worker] Successfully published scheduled post "' + item.id + '"!');
        } else {
          item.status = 'READY_TO_POST';
          item.execution_error = (result && result.message) || 'Manual publishing trigger required';
          updated = true;
          console.warn('⚠️ [Scheduler Worker] Automated post marked READY_TO_POST: ' + item.execution_error);
        }
      } catch (err) {
        item.status = 'READY_TO_POST';
        item.execution_error = err.message;
        updated = true;
      }
    }
  }

  if (updated) {
    saveScheduledPosts(posts);
  }
}

let schedulerInterval = null;
function startSchedulerDaemon() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = setInterval(() => {
    runDueScheduledPosts().catch(e => console.error('[Scheduler Worker Error]:', e.message));
  }, 30000);
  console.log('⏰ [Scheduler Daemon] Active — checking queue every 30 seconds.');
}

module.exports = {
  loadScheduledPosts,
  saveScheduledPosts,
  schedulePost,
  cancelScheduledPost,
  runDueScheduledPosts,
  startSchedulerDaemon
};
