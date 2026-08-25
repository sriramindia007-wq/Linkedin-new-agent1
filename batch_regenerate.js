const fs = require('fs');
const path = require('path');
const { synthesizeNewsArticleTakes, synthesizePostCommentary } = require('./deepContentSynthesisAgent');

async function regenerateAll() {
  console.log('Regenerating all 25 Market News items with deep contextual grounding...');
  const newsPath = path.join(__dirname, 'data', 'market_news.json');
  const news = JSON.parse(fs.readFileSync(newsPath, 'utf-8'));
  
  for (let i = 0; i < news.length; i++) {
    const item = news[i];
    console.log(`[${i+1}/${news.length}] Synthesizing for: ${item.headline}`);
    const takes = await synthesizeNewsArticleTakes(item.article_url, item.headline, item.source_category, item.publisher);
    item.generated_takes = takes;
  }
  fs.writeFileSync(newsPath, JSON.stringify(news, null, 2), 'utf-8');
  
  // Also copy to src_node/data/market_news.json
  const srcNewsPath = path.join(__dirname, 'src_node', 'data', 'market_news.json');
  if (fs.existsSync(path.dirname(srcNewsPath))) {
    fs.writeFileSync(srcNewsPath, JSON.stringify(news, null, 2), 'utf-8');
  }
  console.log('✅ Successfully regenerated all Market News items!');

  console.log('Regenerating all LinkedIn posts commentary...');
  const postsPath = path.join(__dirname, 'data', 'posts.json');
  if (fs.existsSync(postsPath)) {
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'));
    for (let p of posts) {
      const comm = synthesizePostCommentary(p.author_name, p.post_text, p.source_category, p.post_url);
      p.generated_comments = comm;
    }
    fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2), 'utf-8');
    const srcPostsPath = path.join(__dirname, 'src_node', 'data', 'posts.json');
    if (fs.existsSync(path.dirname(srcPostsPath))) {
      fs.writeFileSync(srcPostsPath, JSON.stringify(posts, null, 2), 'utf-8');
    }
    console.log('✅ Successfully regenerated all LinkedIn posts!');
  }
}

regenerateAll().catch(e => console.error(e));
