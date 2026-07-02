// backend/src/seed/seed.js
'use strict';

/**
 * Seeds the productivity modules (Habits, Goals, Daily-Plan Activities, Notes)
 * for demo users so the frontend has real, persisted data to work against.
 *
 * Usage:
 *   npm run seed                      # seeds the built-in demo users
 *   SEED_EMAIL=you@example.com npm run seed   # seeds one existing account
 *
 * Safe to re-run: it removes each target user's existing module data first.
 */

const path    = require('path');
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', envFile) });

const mongoose = require('mongoose');
const logger   = require('../utils/logger');

const User     = require('../models/User');
const Habit    = require('../models/Habit');
const Goal     = require('../models/Goal');
const Activity = require('../models/Activity');
const Note     = require('../models/Note');

const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'Demo@1234';

// Built-in demo accounts seeded for staging. All share DEMO_PASSWORD so QA can
// sign in without juggling credentials. Override the whole set by passing
// SEED_EMAIL to seed a single existing account instead.
const DEMO_USERS = [
  { name: 'Demo User',    email: 'demo@remindus.app' },
  { name: 'Alex Morgan',  email: 'alex@remindus.app' },
  { name: 'Priya Sharma', email: 'priya@remindus.app' },
];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function getOrCreateUser({ name, email }) {
  let user = await User.findOne({ email });
  if (user) {
    logger.info(`Seeding data for existing user: ${user.email}`);
    return user;
  }
  if (process.env.SEED_EMAIL) {
    throw new Error(`No user found with email ${email}. Omit SEED_EMAIL to create demo users.`);
  }
  user = await User.create({
    name,
    email,
    password: DEMO_PASSWORD, // hashed by the User pre-save hook
    isEmailVerified: true,
  });
  logger.info(`Created demo user: ${user.email} / ${DEMO_PASSWORD}`);
  return user;
}

async function seedUser(spec) {
  const user = await getOrCreateUser(spec);
  const uid  = user._id;

  // Clear existing module data for an idempotent re-seed
  await Promise.all([
    Habit.deleteMany({ userId: uid }),
    Goal.deleteMany({ userId: uid }),
    Activity.deleteMany({ userId: uid }),
    Note.deleteMany({ userId: uid }),
  ]);

  const [habits, goals, activities, notes] = await Promise.all([
    Habit.insertMany(habitData(uid)),
    Goal.insertMany(goalData(uid)),
    Activity.insertMany(activityData(uid)),
    Note.insertMany(noteData(uid)),
  ]);

  logger.info(`✅ ${user.email}: ${habits.length} habits, ${goals.length} goals, ${activities.length} activities, ${notes.length} notes`);
  return user;
}

function habitData(userId) {
  return [
    { userId, name: 'Drink water',     goal: '8 glasses a day', color: '#3DA3C9', streak: 12, best: 21, week: [true, true, false, true, true, true, false] },
    { userId, name: 'Morning run',     goal: '2 km · 6:30 AM',  color: '#1AA06D', streak: 5,  best: 14, week: [true, false, true, true, true, false, false] },
    { userId, name: 'Read 20 minutes', goal: 'Before bed',      color: '#7B61D8', streak: 23, best: 23, week: [true, true, true, true, true, true, false] },
    { userId, name: 'Meditate',        goal: '10 min calm',     color: '#159C92', streak: 0,  best: 9,  week: [false, true, true, false, false, false, false] },
  ];
}

function goalData(userId) {
  return [
    { userId, title: 'Run a half marathon', cat: 'Health',   color: '#1AA06D', target: 'Nov 2026', milestones: [{ t: 'Run 5K without stopping', done: true }, { t: 'Run 10K', done: true }, { t: 'Run 15K long run', done: false }, { t: 'Race day — 21K', done: false }] },
    { userId, title: 'Save ₹2,00,000',      cat: 'Finance',  color: '#E08A2B', target: 'Dec 2026', milestones: [{ t: 'First ₹50,000', done: true }, { t: 'Reach ₹1,00,000', done: true }, { t: 'Reach ₹1,50,000', done: false }, { t: 'Hit ₹2,00,000', done: false }] },
    { userId, title: 'Read 24 books',       cat: 'Personal', color: '#3257EE', target: 'Dec 2026', milestones: [{ t: 'Q1 — 6 books', done: true }, { t: 'Q2 — 12 books', done: true }, { t: 'Q3 — 18 books', done: true }, { t: 'Q4 — 24 books', done: false }] },
    { userId, title: 'Launch side project', cat: 'Work',      color: '#159C92', target: 'Done · May 2026', milestones: [{ t: 'Build MVP', done: true }, { t: 'Beta testers', done: true }, { t: 'Public launch', done: true }] },
  ];
}

function activityData(userId) {
  const dayKey = todayKey();
  return [
    { userId, dayKey, title: 'Morning Meds',         startH: 8,  startM: 0,  endH: 8,  endM: 15, color: '#1AA06D', type: 'General', note: 'Vitamin D + B12',     done: false, cat: 'Health' },
    { userId, dayKey, title: 'Team Standup',         startH: 10, startM: 30, endH: 11, endM: 0,  color: '#3257EE', type: 'Meeting', note: 'Daily sync on Slack', done: false, cat: 'Office/Work' },
    { userId, dayKey, title: 'Lunch Break',          startH: 13, startM: 0,  endH: 14, endM: 0,  color: '#E08A2B', type: 'General', note: '',                    done: false, cat: 'None' },
    { userId, dayKey, title: 'Read / Review notes',  startH: 16, startM: 0,  endH: 17, endM: 0,  color: '#7B61D8', type: 'Read',    note: 'Chapter 4 notes',     done: false, cat: 'None' },
    { userId, dayKey, title: 'Evening Walk',         startH: 19, startM: 0,  endH: 19, endM: 45, color: '#159C92', type: 'General', note: '',                    done: false, cat: 'Health' },
  ];
}

function noteData(userId) {
  return [
    { userId, text: 'Buy anniversary gift for Maya — she likes ceramics', color: 'pink',   pinned: true,  priority: 'normal' },
    { userId, text: 'Home wifi: skyline-4827',                            color: 'blue',   pinned: true,  priority: 'normal' },
    { userId, text: 'Grocery run\nMilk · Eggs · Coffee\nSpinach · Oats · Yogurt', color: 'green', pinned: false, priority: 'normal' },
    { userId, text: 'Call the plumber about the kitchen tap leak',         color: 'yellow', pinned: false, priority: 'high' },
    { userId, text: 'Gift ideas for Dad\n- Wireless headphones\n- A good book', color: 'purple', pinned: false, priority: 'normal' },
    { userId, text: 'Gym locker code: 1532',                              color: 'yellow', pinned: false, priority: 'normal' },
  ];
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Check your .env file.');
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000, family: 4 });
  logger.info(`Connected to MongoDB [${process.env.NODE_ENV || 'development'}]`);

  // A single explicit SEED_EMAIL seeds just that existing account; otherwise
  // seed the whole built-in demo set.
  const specs = process.env.SEED_EMAIL
    ? [{ name: 'Demo User', email: process.env.SEED_EMAIL }]
    : DEMO_USERS;

  const users = [];
  for (const spec of specs) {
    users.push(await seedUser(spec));
  }

  logger.info('───────────────────────────────────────────────');
  logger.info(`✅ Seed complete for ${users.length} user(s) — day ${todayKey()}`);
  logger.info(`   Password (all): ${DEMO_PASSWORD}`);
  for (const u of users) logger.info(`   • ${u.email}`);
  logger.info('───────────────────────────────────────────────');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
