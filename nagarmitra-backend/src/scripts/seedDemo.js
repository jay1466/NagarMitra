// Seeds the full India hierarchy of demo accounts plus complaints, posts and notifications.
// Safe to re-run: every @nagarmitra.demo account and its data is replaced.
//
//   node src/scripts/seedDemo.js
//
// Username format (all lowercase; every account gets DEMO_PASSWORD from .env)
//   super admin       superadmin@nagarmitra.demo
//   state admin       admin.<state>@nagarmitra.demo                 e.g. admin.gj@nagarmitra.demo
//   district admin    admin.<state>.<district>@nagarmitra.demo      e.g. admin.gj.anand@nagarmitra.demo
//   officer           <dept>.<state>.<district>@nagarmitra.demo     e.g. roads.gj.anand@nagarmitra.demo
//   citizen           citizen.<state>.<district>@nagarmitra.demo    e.g. citizen.gj.anand@nagarmitra.demo
// departments: roads, sanitation, water, electricity, general
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { firebaseAdmin } from '../config/firebaseAdmin.js';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';
import CommunityPost from '../models/CommunityPost.js';
import Notification from '../models/Notification.js';
import { INDIA, DEPARTMENTS, departmentFor, deadlinesFor, locationLabel } from '../config/civic.js';
import { slaSweep } from '../services/workflow.js';

const DOMAIN = '@nagarmitra.demo';
// Kept out of source control: set DEMO_PASSWORD in nagarmitra-backend/.env
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD || PASSWORD.length < 8) {
  console.error('Set DEMO_PASSWORD (8+ characters) in nagarmitra-backend/.env before seeding.');
  process.exit(1);
}
const HOUR = 3600 * 1000;

const DESIGNATIONS = {
  roads: 'Assistant Engineer, Roads',
  sanitation: 'Sanitary Inspector',
  water: 'Water Works Engineer',
  electricity: 'Electrical Engineer',
  general: 'Ward Officer',
};
const FIRST = ['Aarav', 'Diya', 'Kabir', 'Riya', 'Arjun', 'Ananya', 'Vihaan', 'Isha', 'Rohan', 'Meera', 'Aditya', 'Sneha', 'Karan', 'Pooja', 'Imran', 'Neha', 'Ravi', 'Priya', 'Sahil', 'Kavya'];
const LAST = ['Sharma', 'Patel', 'Khan', 'Iyer', 'Reddy', 'Das', 'Singh', 'Mehta', 'Joshi', 'Nair', 'Gupta', 'Desai', 'Shah', 'Verma', 'Rao', 'Bose'];

// Deterministic pseudo-random numbers so every run produces the same demo data
function rng(seed) {
  let x = seed;
  return () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
}
const nameFor = (i) => `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
const uidFor = (email) => `demo-${email.split('@')[0].replace(/[^a-z0-9]/g, '-')}`.slice(0, 120);

// ------------------------------------------------------------------ accounts
function buildAccounts() {
  const list = [{ email: `superadmin${DOMAIN}`, name: 'National Super Admin', role: 'super_admin', designation: 'Super Admin (India)' }];
  let n = 0;
  for (const s of INDIA) {
    const st = s.code.toLowerCase();
    list.push({ email: `admin.${st}${DOMAIN}`, name: `${s.name} State Admin`, role: 'state_admin', state: s.code, designation: `State Master Admin, ${s.name}` });
    for (const d of s.districts) {
      const base = `${st}.${d.code}`;
      list.push({ email: `admin.${base}${DOMAIN}`, name: `${d.name} District Admin`, role: 'district_admin', state: s.code, district: d.code, designation: `District Admin, ${d.name}` });
      for (const dept of Object.keys(DEPARTMENTS)) {
        list.push({ email: `${dept}.${base}${DOMAIN}`, name: nameFor(n++), role: 'officer', state: s.code, district: d.code, department: dept, designation: `${DESIGNATIONS[dept]}, ${d.name}` });
      }
      list.push({ email: `citizen.${base}${DOMAIN}`, name: nameFor(n++ + 3), role: 'citizen', state: s.code, district: d.code });
    }
  }
  return list;
}

async function deleteOldFirebaseDemoUsers() {
  const auth = firebaseAdmin.auth();
  let token;
  let removed = 0;
  do {
    const page = await auth.listUsers(1000, token);
    const uids = page.users.filter((u) => u.email?.endsWith(DOMAIN)).map((u) => u.uid);
    if (uids.length) {
      await auth.deleteUsers(uids);
      removed += uids.length;
    }
    token = page.pageToken;
  } while (token);
  return removed;
}

async function importFirebaseUsers(accounts) {
  const hash = Buffer.from(bcrypt.hashSync(PASSWORD, 10));
  let failed = 0;
  for (let i = 0; i < accounts.length; i += 1000) {
    const batch = accounts.slice(i, i + 1000).map((a) => ({
      uid: uidFor(a.email),
      email: a.email,
      displayName: a.name,
      emailVerified: true,
      passwordHash: hash,
    }));
    const res = await firebaseAdmin.auth().importUsers(batch, { hash: { algorithm: 'BCRYPT' } });
    failed += res.failureCount;
    res.errors.slice(0, 3).forEach((e) => console.warn('  import error:', batch[e.index].email, e.error.message));
    process.stdout.write(`  firebase ${Math.min(i + 1000, accounts.length)}/${accounts.length}\r`);
  }
  console.log();
  return failed;
}

// ------------------------------------------------------------------ complaints
// [state, district, count, [lat, lng]]
const HOTSPOTS = [
  ['GJ', 'anand', 18, [22.5560, 72.9510]],
  ['GJ', 'ahmedabad', 8, [23.0225, 72.5714]],
  ['GJ', 'vadodara', 5, [22.3072, 73.1812]],
  ['GJ', 'surat', 5, [21.1702, 72.8311]],
  ['MH', 'mumbai', 4, [18.9388, 72.8354]],
  ['MH', 'pune', 3, [18.5204, 73.8567]],
  ['DL', 'new-delhi', 4, [28.6139, 77.2090]],
  ['KA', 'bengaluru-urban', 3, [12.9716, 77.5946]],
  ['TN', 'chennai', 3, [13.0827, 80.2707]],
  ['UP', 'lucknow', 3, [26.8467, 80.9462]],
  ['RJ', 'jaipur', 2, [26.9124, 75.7873]],
  ['WB', 'kolkata', 2, [22.5726, 88.3639]],
];

const TEMPLATES = {
  Potholes: [
    'Deep pothole on the main road, two-wheelers are skidding every evening.',
    'Road surface broken after rain, potholes all along the lane.',
    'Manhole cover sunk below road level creating a dangerous pit.',
    'Speed breaker damaged and turned into a crater near the school.',
  ],
  Sanitation: [
    'Open drain overflowing on to the footpath after rain.',
    'Public toilet near the market has not been cleaned for days.',
    'Mosquito breeding in stagnant water on the empty plot.',
  ],
  'Waste Management': [
    'Garbage has not been collected from the society bins for 4 days.',
    'Overflowing community dustbin, waste spread on the road by animals.',
    'Garbage dumped and burning on the open plot, smoke entering houses.',
  ],
  'Water Supply': [
    'No water supply in the whole lane since yesterday morning.',
    'Pipeline burst near the junction, water flowing on the road all day.',
    'Muddy water coming from the taps for two days.',
  ],
  'Electricity & Lighting': [
    'Street lights are off on the main road for a week, the stretch is dark.',
    'Electric pole leaning dangerously after the storm.',
    'Transformer sparking near the school, dangerous for children.',
  ],
  Miscellaneous: [
    'Tree branch fallen on the road after the storm, not removed.',
    'Encroachment on the footpath by hawkers, no space to walk.',
    'Stray cattle blocking the road near the circle every morning.',
  ],
};
const PLACES = ['Main road', 'Station road', 'Market area', 'Bus stand', 'College road', 'Old city', 'Ring road', 'Housing society', 'Near the temple', 'Hospital road'];
// Spread across every stage of the workflow
const STATUS_MIX = ['submitted_unassigned', 'assigned', 'assigned', 'acknowledged', 'acknowledged', 'in_progress', 'in_progress', 'resolved', 'closed', 'closed', 'rejected'];
const REJECT_REASONS = [
  'Duplicate of an existing complaint at the same location.',
  'Private property issue, not under municipal jurisdiction.',
  'Could not locate the issue at the given address; please re-submit with a photo.',
  'Handled by the state electricity board; forwarded to their helpline.',
];

const historyEntry = (status, at, actor, notes) => ({
  status,
  changedAt: at,
  changedBy: actor?._id,
  byName: actor ? actor.displayName : 'System',
  byRole: actor?.role || 'system',
  notes,
});

async function main() {
  if (!firebaseAdmin.apps.length) throw new Error('Firebase Admin is not configured (check .env)');
  await connectDB();
  const started = Date.now();

  // 1) Clean slate for demo data
  const old = await User.find({ email: { $regex: '@nagarmitra\\.demo$' } }).select('_id');
  const oldIds = old.map((u) => u._id);
  await Promise.all([
    Complaint.deleteMany({ userId: { $in: oldIds } }),
    CommunityPost.deleteMany({ author: { $in: oldIds } }),
    Notification.deleteMany({ recipient: { $in: oldIds } }),
  ]);
  await User.deleteMany({ _id: { $in: oldIds } });
  console.log(`Removed ${oldIds.length} old demo profiles and ${await deleteOldFirebaseDemoUsers()} old demo logins`);

  // 2) Accounts: Firebase logins (bulk import) + NagarMitra profiles
  const accounts = buildAccounts();
  console.log(`Creating ${accounts.length} accounts…`);
  const failed = await importFirebaseUsers(accounts);
  await User.insertMany(
    accounts.map((a) => ({
      firebaseUid: uidFor(a.email),
      email: a.email,
      displayName: a.name,
      role: a.role,
      state: a.state,
      district: a.district,
      department: a.department,
      designation: a.designation,
      isActive: true,
      isVerified: true,
      profile: { city: a.district ? locationLabel(a.state, a.district).split(',')[0] : undefined },
    })),
    { ordered: false }
  );
  console.log(`Accounts ready (${failed} Firebase failures)`);

  const byEmail = async (email) => User.findOne({ email });
  const rand = rng(7);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const categories = Object.keys(TEMPLATES);
  const priorities = ['Low', 'Medium', 'Medium', 'High', 'High', 'Critical'];

  // 3) Complaints
  let seq = 0;
  let made = 0;
  for (const [state, district, count, center] of HOTSPOTS) {
    const base = `${state.toLowerCase()}.${district}`;
    const citizen = await byEmail(`citizen.${base}${DOMAIN}`);
    const officers = Object.fromEntries(
      await Promise.all(Object.keys(DEPARTMENTS).map(async (d) => [d, await byEmail(`${d}.${base}${DOMAIN}`)]))
    );
    for (let i = 0; i < count; i++) {
      // seq advances once per complaint, so these walk through every status and category
      const status = STATUS_MIX[seq % STATUS_MIX.length];
      const category = categories[Math.floor(seq / 2 + i) % categories.length];
      const priority = pick(priorities);
      const department = departmentFor(category);
      const officer = status === 'submitted_unassigned' ? null : officers[department];
      const finished = ['resolved', 'closed', 'rejected'].includes(status);
      // a mix of fresh and overdue open complaints; finished ones are older
      const hoursAgo = status === 'resolved' ? 20 + rand() * 100 : finished ? 150 + rand() * 500 : 2 + rand() * 200;
      const created = new Date(Date.now() - hoursAgo * HOUR);
      const at = (h) => new Date(created.getTime() + h * HOUR);
      const { acknowledgeDueAt, dueAt } = deadlinesFor(category, priority, created);

      const history = [historyEntry('submitted', created, null, 'Complaint registered')];
      const doc = {
        reportId: `NM-${state}-${created.toISOString().slice(0, 10).replace(/-/g, '')}-${String(9000 + ++seq)}`,
        title: `${category} issue`,
        description: pick(TEMPLATES[category]),
        category,
        priority,
        address: `${pick(PLACES)}, ${locationLabel(state, district)}`,
        state,
        district,
        department,
        location: { type: 'Point', coordinates: [center[1] + (rand() - 0.5) * 0.06, center[0] + (rand() - 0.5) * 0.06] },
        userId: citizen._id,
        firebaseUid: citizen.firebaseUid,
        firebaseEmail: citizen.email,
        acknowledgeDueAt,
        dueAt,
        status: 'submitted',
        escalationLevel: 0,
        reopenCount: 0,
        media: [],
        createdAt: created,
        updatedAt: created,
      };
      if (officer) {
        doc.assignedTo = officer._id;
        doc.assignedAt = at(0.01);
        doc.status = 'assigned';
        history.push(historyEntry('assigned', doc.assignedAt, null, `Auto-assigned by department and district → ${officer.displayName}`));
      }
      const steps = ['acknowledged', 'in_progress', 'resolved', 'closed'];
      const target = steps.indexOf(status);
      const span = Math.min(hoursAgo * 0.8, 60);
      if (target >= 0 || status === 'rejected') {
        doc.status = 'acknowledged';
        doc.acknowledgmentDate = at(span * 0.1);
        history.push(historyEntry('acknowledged', doc.acknowledgmentDate, officer, 'Site inspection scheduled'));
      }
      if (target >= 1) {
        doc.status = 'in_progress';
        doc.startDate = at(span * 0.3);
        history.push(historyEntry('in_progress', doc.startDate, officer, 'Work crew assigned'));
      }
      if (target >= 2) {
        doc.status = 'resolved';
        doc.completionDate = at(span * 0.6);
        doc.resolution = { note: 'Issue fixed by the field team. Please confirm.', at: doc.completionDate };
        history.push(historyEntry('resolved', doc.completionDate, officer, doc.resolution.note));
      }
      if (target >= 3) {
        doc.status = 'closed';
        doc.closedAt = at(span * 0.9);
        doc.citizenRating = 3 + (seq % 3);
        history.push(historyEntry('closed', doc.closedAt, citizen, `Citizen confirmed the fix (${doc.citizenRating}★)`));
      }
      if (status === 'rejected') {
        doc.status = 'rejected';
        doc.rejectionReason = REJECT_REASONS[seq % REJECT_REASONS.length];
        history.push(historyEntry('rejected', at(span * 0.2), officer, doc.rejectionReason));
      }
      doc.statusHistory = history;
      const { insertedId } = await Complaint.collection.insertOne(doc);
      made++;

      const notes = [['complaint_confirmed', 'Complaint registered', `Your report #${doc.reportId} was sent to ${DEPARTMENTS[department].name}, ${locationLabel(state, district)}.`]];
      if (['acknowledged', 'in_progress', 'resolved', 'closed', 'rejected'].includes(doc.status)) notes.push(['complaint_acknowledged', 'Complaint acknowledged', `An officer has reviewed #${doc.reportId}.`]);
      if (['in_progress', 'resolved', 'closed'].includes(doc.status)) notes.push(['complaint_in_progress', 'Work started', `Work has started on #${doc.reportId}.`]);
      if (['resolved', 'closed'].includes(doc.status)) notes.push(['complaint_resolved', 'Issue resolved', `#${doc.reportId} is marked resolved. Please confirm or reopen it.`]);
      if (doc.status === 'rejected') notes.push(['complaint_rejected', 'Complaint rejected', `#${doc.reportId} was rejected: ${doc.rejectionReason}`]);
      await Notification.insertMany(
        notes.map(([type, title, body], k) => ({
          recipient: citizen._id,
          type,
          title,
          body,
          relatedComplaint: insertedId,
          data: { reportId: doc.reportId },
          interaction: { isRead: k < notes.length - 1 },
        }))
      );
      if (officer) {
        await Notification.create({
          recipient: officer._id,
          type: 'complaint_assigned',
          title: 'New complaint assigned to you',
          body: `#${doc.reportId}: ${category} in ${locationLabel(state, district)}.`,
          relatedComplaint: insertedId,
          data: { reportId: doc.reportId },
        });
      }
    }
  }
  console.log(`Complaints created: ${made}`);

  // 4) Community posts from citizens in the busiest districts
  const POSTS = [
    ['gj.anand', 'roads', false, 'The pothole outside the college gate is getting worse every day. Reported it on NagarMitra, please upvote! #roads'],
    ['gj.anand', 'water', false, 'Water pipe on Grid road got fixed within a day of reporting. Thank you Water Works team! 👏 #water'],
    ['gj.ahmedabad', 'garbage', false, 'Garbage burning near the ring road again. Anyone else facing smoke in the evening? #cleanCity'],
    ['gj.vadodara', 'electricity', false, 'Street lights on our road are back on after 8 days. Feels much safer now.'],
    ['mh.mumbai', 'safety', true, 'Please be careful near the station east gate after dark, the big pothole is not visible.'],
    ['dl.new-delhi', 'parks', false, 'Can we organise a clean-up drive at the community park this Sunday? Comment if you can join! 🌳'],
    ['ka.bengaluru-urban', 'general', false, 'Tip: you can track any complaint with its report ID on the Dashboard tab.'],
    ['tn.chennai', 'noise', true, 'Construction noise continues past 11 pm near the hostel area. Is there a rule for this?'],
    ['gj.surat', 'roads', false, 'Ring road finally resurfaced! Smooth ride today 🚗 #roads'],
    ['up.lucknow', 'water', false, 'Anyone else getting low water pressure in the mornings? #water'],
    ['gj.anand', 'garbage', false, 'Door-to-door collection is regular again in our society. Good work sanitation team 👍'],
    ['rj.jaipur', 'general', false, 'Reported a fallen tree branch, officer acknowledged within 2 hours. Impressed!'],
  ];
  const posters = await User.find({ email: { $in: POSTS.map(([b]) => `citizen.${b}${DOMAIN}`) } });
  const posterBy = Object.fromEntries(posters.map((p) => [p.email, p]));
  for (const [i, [b, category, isAnonymous, caption]] of POSTS.entries()) {
    const author = posterBy[`citizen.${b}${DOMAIN}`];
    const likers = posters.filter((p, j) => (i + j) % 3 === 0 && p !== author).map((p) => p._id);
    const createdAt = new Date(Date.now() - (i * 5 + 1) * HOUR);
    await CommunityPost.collection.insertOne({
      author: author._id,
      content: { caption, hashtags: (caption.match(/#\w+/g) || []).map((t) => t.toLowerCase()) },
      category,
      isAnonymous,
      isPublic: true,
      isActive: true,
      isFeatured: false,
      location: { address: locationLabel(author.state, author.district) },
      metrics: { views: 10 + i * 7, likes: likers.length, dislikes: 0, comments: 0, shares: i % 3, upvotes: likers.length + (i % 4), downvotes: i % 2 },
      likedBy: likers,
      dislikedBy: [],
      upvotedBy: likers,
      downvotedBy: [],
      createdAt,
      updatedAt: createdAt,
    });
  }
  console.log(`Posts created: ${POSTS.length}`);

  // 5) Run the SLA engine so reminders/escalations exist like in production
  console.log('SLA sweep:', await slaSweep());

  const counts = await User.aggregate([{ $match: { email: { $regex: '@nagarmitra\\.demo$' } } }, { $group: { _id: '$role', n: { $sum: 1 } } }]);
  console.log('Accounts by role:', Object.fromEntries(counts.map((c) => [c._id, c.n])));
  console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s. All accounts use DEMO_PASSWORD from .env.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seeding failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
