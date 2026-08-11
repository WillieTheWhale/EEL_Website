/**
 * Applications API Routes
 * Handles form submissions and file uploads
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Ensure directories exist
const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const applicationsFile = path.join(dataDir, 'applications.json');

// Initialize applications file if it doesn't exist
if (!fs.existsSync(applicationsFile)) {
    fs.writeFileSync(applicationsFile, '[]', 'utf8');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Helper: Load applications
function loadApplications() {
    try {
        const data = fs.readFileSync(applicationsFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Helper: Save applications
function saveApplications(applications) {
    fs.writeFileSync(applicationsFile, JSON.stringify(applications, null, 2), 'utf8');
}

// Helper: Create SMTP transporter
// Supports three modes:
//   1. SMTP_HOST with credentials  — authenticated external SMTP
//   2. SMTP_HOST without credentials — unauthenticated relay (e.g. relay.unc.edu)
//   3. No SMTP_HOST + Gmail creds  — Gmail SMTP (local dev default)
function createMailTransporter() {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT) || 587;

    if (smtpHost) {
        const opts = {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            tls: { rejectUnauthorized: false }
        };
        // Only add auth if credentials are provided (relay.unc.edu needs no auth)
        if (emailUser && emailPass) {
            opts.auth = { user: emailUser, pass: emailPass };
        }
        return nodemailer.createTransport(opts);
    }

    // Default: Gmail
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass }
    });
}

function notificationRecipients() {
    const configuredRecipients = process.env.NOTIFY_EMAILS || process.env.NOTIFY_EMAIL || 'wilk05@unc.edu';
    return [...new Set(
        configuredRecipients
            .split(/[;,]/)
            .map((recipient) => recipient.trim())
            .filter(Boolean)
    )];
}

// Send one message per reviewer so recipients cannot see one another.
async function sendNotificationEmail(application) {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const smtpHost = process.env.SMTP_HOST;
    const smtpFrom = process.env.SMTP_FROM || emailUser;
    const recipients = notificationRecipients();

    // Need either SMTP_HOST (relay, no creds required) or Gmail creds
    if (!smtpHost && (!emailUser || !emailPass)) {
        console.log('Email not configured (set SMTP_HOST for relay or EMAIL_USER/EMAIL_PASS for Gmail)');
        return;
    }

    if (!smtpFrom) {
        console.log('No sender address configured (set SMTP_FROM or EMAIL_USER)');
        return;
    }

    if (!recipients.length) {
        console.log('No notification recipients configured (set NOTIFY_EMAILS or NOTIFY_EMAIL)');
        return;
    }

    try {
        const transporter = createMailTransporter();

        // Build resume attachment
        const attachments = [];
        if (application.resumePath) {
            const resumeFile = path.join(uploadsDir, application.resumePath);
            if (fs.existsSync(resumeFile)) {
                attachments.push({
                    filename: application.resumeFilename,
                    path: resumeFile,
                    contentType: 'application/pdf'
                });
            }
        }

        // Escape HTML in user-provided text
        function esc(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // Format multi-line text, preserving line breaks
        function fmt(str) {
            return esc(str).replace(/\n/g, '<br>');
        }

        const submittedDate = new Date(application.submittedAt).toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });

        const siteUrl = (process.env.SITE_URL || 'http://localhost:8080').replace(/\/$/, '');
        const dashboardUrl = `${siteUrl}/admin`;
        const linkedIn = application.linkedin
            ? `<a href="${esc(application.linkedin)}" style="color:#0056a6;">${esc(application.linkedin)}</a>`
            : 'Not provided';
        const html = `<!doctype html>
<html lang="en"><body style="margin:0; padding:0; background:#f5f6f7; color:#1f2933; font-family:Arial, Helvetica, sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f6f7;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:640px; background:#ffffff; border:1px solid #d9dee3;">
<tr><td style="height:6px; background:#4b9cd3;"></td></tr>
<tr><td style="padding:28px 32px 22px; border-bottom:1px solid #d9dee3;"><p style="margin:0 0 6px; color:#13294b; font-size:21px; font-weight:700;">Experimental Engineering Lab</p><p style="margin:0; color:#52606d; font-size:14px;">University of North Carolina at Chapel Hill</p></td></tr>
<tr><td style="padding:28px 32px 8px;"><h1 style="margin:0 0 10px; color:#13294b; font-size:20px; line-height:1.3;">New application received</h1><p style="margin:0; color:#52606d; font-size:14px; line-height:1.5;">Reference ${esc(application.reference)} &middot; Submitted ${submittedDate}</p></td></tr>
<tr><td style="padding:12px 32px 8px;"><h2 style="margin:0; padding-bottom:8px; color:#13294b; font-size:16px; border-bottom:1px solid #d9dee3;">Applicant information</h2></td></tr>
<tr><td style="padding:0 32px 14px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:14px; line-height:1.5;">
<tr><td style="padding:5px 12px 5px 0; width:150px; color:#52606d; font-weight:700;">Full name</td><td style="padding:5px 0;">${esc(application.fullName)}</td></tr>
<tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Pronouns</td><td style="padding:5px 0;">${esc(application.pronouns) || 'Not provided'}</td></tr>
<tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">UNC email</td><td style="padding:5px 0;"><a href="mailto:${esc(application.email)}" style="color:#0056a6;">${esc(application.email)}</a></td></tr>
<tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Year of study</td><td style="padding:5px 0;">${esc(application.yearOfStudy)}</td></tr>
<tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Major</td><td style="padding:5px 0;">${esc(application.major)}</td></tr>
<tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">LinkedIn</td><td style="padding:5px 0;">${linkedIn}</td></tr>
<tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Availability</td><td style="padding:5px 0;">${application.hours} hours per week</td></tr>
<tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Resume</td><td style="padding:5px 0;">${esc(application.resumeFilename)} (attached)</td></tr>
</table></td></tr>
<tr><td style="padding:12px 32px 8px;"><h2 style="margin:0; padding-bottom:8px; color:#13294b; font-size:16px; border-bottom:1px solid #d9dee3;">Application responses</h2></td></tr>
<tr><td style="padding:0 32px 28px; font-size:14px; line-height:1.55;"><p style="margin:14px 0 4px; color:#52606d; font-weight:700;">Contribution to the lab</p><p style="margin:0;">${fmt(application.contribution)}</p><p style="margin:18px 0 4px; color:#52606d; font-weight:700;">Project idea</p><p style="margin:0;">${fmt(application.projectIdea)}</p><p style="margin:18px 0 4px; color:#52606d; font-weight:700;">Additional information</p><p style="margin:0;">${fmt(application.additionalSkills) || 'Not provided'}</p></td></tr>
<tr><td style="padding:18px 32px; background:#f5f6f7; border-top:1px solid #d9dee3; color:#52606d; font-size:12px; line-height:1.5;"><a href="${esc(dashboardUrl)}" style="color:#0056a6;">View in the application dashboard</a><br>This notification was sent directly to you as an Experimental Engineering Lab application reviewer.</td></tr>
</table></td></tr></table>
</body></html>`;
        const subject = `New EEL application - ${application.fullName}`;
        const text = [
            'Experimental Engineering Lab',
            'University of North Carolina at Chapel Hill',
            '',
            'New application received',
            `Reference: ${application.reference}`,
            `Submitted: ${submittedDate}`,
            '',
            `Full name: ${application.fullName}`,
            `Pronouns: ${application.pronouns || 'Not provided'}`,
            `UNC email: ${application.email}`,
            `Year of study: ${application.yearOfStudy}`,
            `Major: ${application.major}`,
            `LinkedIn: ${application.linkedin || 'Not provided'}`,
            `Availability: ${application.hours} hours per week`,
            `Resume: ${application.resumeFilename} (attached)`,
            '',
            'Contribution to the lab:', application.contribution,
            '', 'Project idea:', application.projectIdea,
            '', 'Additional information:', application.additionalSkills || 'Not provided',
            '', `Application dashboard: ${dashboardUrl}`
        ].join('\n');
        const deliveryResults = await Promise.allSettled(
            recipients.map((recipient) => transporter.sendMail({
                from: `"Experimental Engineering Lab" <${smtpFrom}>`,
                to: recipient,
                subject,
                text,
                html,
                attachments
            }))
        );
        deliveryResults.forEach((result, index) => {
            const recipient = recipients[index];
            if (result.status === 'fulfilled') {
                console.log(`Notification email sent to: ${recipient}`);
            } else {
                console.error(`Failed to send notification email to ${recipient}:`, result.reason.message);
            }
        });
    } catch (err) {
        console.error('Failed to send notification email:', err.message);
    }
}

// POST /api/applications - Submit new application
router.post('/', upload.single('resume'), async (req, res) => {
    try {
        const { fullName, pronouns, email, yearOfStudy, major, linkedin, hours, contribution, projectIdea, additionalSkills } = req.body;

        // Validate required fields
        if (!fullName || !email || !yearOfStudy || !major || !hours || !contribution || !projectIdea) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate email format
        if (!email.endsWith('@unc.edu')) {
            return res.status(400).json({ error: 'Must use a valid @unc.edu email address' });
        }

        // Validate resume
        if (!req.file) {
            return res.status(400).json({ error: 'Resume PDF is required' });
        }

        // Generate reference ID
        const reference = 'EEL-' + Date.now().toString(36).toUpperCase() +
                         '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

        const application = {
            id: Date.now().toString(),
            reference,
            fullName,
            pronouns: pronouns || '',
            email,
            yearOfStudy,
            major,
            linkedin: linkedin || '',
            hours: parseInt(hours),
            contribution,
            projectIdea,
            additionalSkills: additionalSkills || '',
            resumeFilename: req.file.originalname,
            resumePath: req.file.filename,
            submittedAt: new Date().toISOString(),
            status: 'pending'
        };

        // Save to JSON file
        const applications = loadApplications();
        applications.push(application);
        saveApplications(applications);

        console.log(`New application received: ${reference} from ${fullName}`);

        // Send notification email (async, don't wait)
        sendNotificationEmail(application);

        res.status(201).json({
            success: true,
            reference: application.reference,
            message: 'Application submitted successfully'
        });

    } catch (err) {
        console.error('Error processing application:', err);
        res.status(500).json({ error: 'Failed to process application' });
    }
});

// GET /api/applications - List all applications (protected)
router.get('/', (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || 'eel-admin-2024';

    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const applications = loadApplications();
    res.json(applications);
});

// GET /api/applications/:id/resume - Download resume (protected)
router.get('/:id/resume', (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || 'eel-admin-2024';

    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const applications = loadApplications();
    const application = applications.find(a => a.id === req.params.id);

    if (!application) {
        return res.status(404).json({ error: 'Application not found' });
    }

    const resumePath = path.join(uploadsDir, application.resumePath);
    if (!fs.existsSync(resumePath)) {
        return res.status(404).json({ error: 'Resume file not found' });
    }

    res.download(resumePath, application.resumeFilename);
});

// DELETE /api/applications/:id - Delete application (protected)
router.delete('/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || 'eel-admin-2024';

    if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const applications = loadApplications();
    const index = applications.findIndex(a => a.id === req.params.id);

    if (index === -1) {
        return res.status(404).json({ error: 'Application not found' });
    }

    // Delete resume file
    const resumePath = path.join(uploadsDir, applications[index].resumePath);
    if (fs.existsSync(resumePath)) {
        fs.unlinkSync(resumePath);
    }

    applications.splice(index, 1);
    saveApplications(applications);

    res.json({ success: true, message: 'Application deleted' });
});

module.exports = router;
