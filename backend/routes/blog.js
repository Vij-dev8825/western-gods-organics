const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/blog — published posts only, newest first
router.get('/', async (req, res, next) => {
  try {
    const [posts, settings, comments] = await Promise.all([
      db.list('blog-posts'),
      db.get('blog-settings', 'main'),
      db.list('blog-comments'),
    ]);
    const published = posts.filter((p) => p.published).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      success: true,
      posts: published.map(({ content, ...rest }) => ({
        ...rest, // full body only on the detail route
        commentsCount: comments.filter((c) => c.postId === rest.id).length,
      })),
      bannerImage: settings?.bannerImage || '',
      bannerTitle: settings?.bannerTitle || '',
      bannerSubtitle: settings?.bannerSubtitle || '',
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
    const commentsCount = (await db.list('blog-comments')).filter((c) => c.postId === post.id).length;
    res.json({ success: true, post: { ...post, commentsCount } });
  } catch (err) {
    next(err);
  }
});

// POST /api/blog/:slug/like — anonymous, one click = one like. There's no
// per-visitor tracking server-side (the frontend guards against re-clicking
// via localStorage), so treat the count as a lightweight engagement signal
// rather than an exact, tamper-proof number.
router.post('/:slug/like', async (req, res, next) => {
  try {
    const post = await db.get('blog-posts', req.params.slug);
    if (!post || !post.published) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }
    post.likes = (post.likes || 0) + 1;
    await db.put('blog-posts', post);
    res.json({ success: true, likes: post.likes });
  } catch (err) {
    next(err);
  }
});

// GET /api/blog/:slug/comments — public
router.get('/:slug/comments', async (req, res, next) => {
  try {
    const comments = (await db.list('blog-comments'))
      .filter((c) => c.postId === req.params.slug)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    res.json({ success: true, comments });
  } catch (err) {
    next(err);
  }
});

// POST /api/blog/:slug/comments  { text } — requires login, same as product reviews
router.post('/:slug/comments', requireAuth, async (req, res, next) => {
  try {
    const post = await db.get('blog-posts', req.params.slug);
    if (!post || !post.published) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }
    const text = (req.body.text || '').trim().slice(0, 1000);
    if (!text) return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });

    const author = await db.get('users', req.user.id);
    const comment = {
      id: uuid(),
      postId: req.params.slug,
      userId: req.user.id,
      userName: author?.name || 'Customer',
      text,
      createdAt: new Date().toISOString(),
    };
    await db.put('blog-comments', comment);
    res.status(201).json({ success: true, comment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
