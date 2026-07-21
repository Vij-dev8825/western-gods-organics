const express = require('express');
const db = require('../data/db');

const router = express.Router();

// GET /api/blog — published posts only, newest first
router.get('/', async (req, res, next) => {
  try {
    const posts = (await db.list('blog-posts'))
      .filter((p) => p.published)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      success: true,
      posts: posts.map(({ content, ...rest }) => rest), // full body only on the detail route
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/blog/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const post = await db.get('blog-posts', req.params.slug);
    if (!post || !post.published) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }
    res.json({ success: true, post });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
