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

// Helper: Send notification email with resume attachment
async function sendNotificationEmail(application) {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const smtpHost = process.env.SMTP_HOST;
    const smtpFrom = process.env.SMTP_FROM || emailUser;
    const notifyEmail = process.env.NOTIFY_EMAIL || 'wilk05@unc.edu';

    // Need either SMTP_HOST (relay, no creds required) or Gmail creds
    if (!smtpHost && (!emailUser || !emailPass)) {
        console.log('Email not configured (set SMTP_HOST for relay or EMAIL_USER/EMAIL_PASS for Gmail)');
        return;
    }

    if (!smtpFrom) {
        console.log('No sender address configured (set SMTP_FROM or EMAIL_USER)');
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
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // Format multi-line text, preserving line breaks
        function fmt(str) {
            return esc(str).replace(/\n/g, '<br>');
        }

        const submittedDate = new Date(application.submittedAt).toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        });

        const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
    <div style="background: #1a2a3a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #7ec8e3; margin: 0; font-size: 20px; font-weight: 400; letter-spacing: 1px;">
            E.E.L. &mdash; New Application
        </h1>
    </div>
    <div style="background: #f9f9f9; padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">

        <p style="margin: 0 0 16px; padding: 10px 14px; background: #e8f4f8; border-left: 4px solid #7ec8e3; border-radius: 4px; font-size: 14px;">
            Reference: <strong>${esc(application.reference)}</strong> &nbsp;|&nbsp; Submitted: ${submittedDate}
        </p>

        <h2 style="font-size: 15px; color: #1a2a3a; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin: 20px 0 12px;">
            Identification
        </h2>
        <p style="margin: 6px 0;"><strong>Full Name:</strong> ${esc(application.fullName)}</p>
        <p style="margin: 6px 0;"><strong>Pronouns:</strong> ${esc(application.pronouns) || 'Not provided'}</p>
        <p style="margin: 6px 0;"><strong>UNC Email:</strong> <a href="mailto:${esc(application.email)}">${esc(application.email)}</a></p>
        <p style="margin: 6px 0;"><strong>Year of Study:</strong> ${esc(application.yearOfStudy)}</p>
        <p style="margin: 6px 0;"><strong>Major:</strong> ${esc(application.major)}</p>
        <p style="margin: 6px 0;"><strong>LinkedIn:</strong> ${application.linkedin ? '<a href="' + esc(application.linkedin) + '">' + esc(application.linkedin) + '</a>' : 'Not provided'}</p>

        <h2 style="font-size: 15px; color: #1a2a3a; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin: 20px 0 12px;">
            Documentation
        </h2>
        <p style="margin: 6px 0;"><strong>Weekly Availability:</strong> ${application.hours} hours/week</p>
        <p style="margin: 6px 0;"><strong>Resume:</strong> ${esc(application.resumeFilename)} (attached)</p>

        <h2 style="font-size: 15px; color: #1a2a3a; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin: 20px 0 12px;">
            Aptitude Assessment
        </h2>

        <p style="margin: 12px 0 4px;"><strong>What can you contribute to E.E.L.?</strong></p>
        <div style="margin: 0 0 16px; padding: 10px 14px; background: #fff; border: 1px solid #e8e8e8; border-radius: 4px; font-size: 14px; line-height: 1.6;">
            ${fmt(application.contribution)}
        </div>

        <p style="margin: 12px 0 4px;"><strong>Project Proposal:</strong></p>
        <div style="margin: 0 0 16px; padding: 10px 14px; background: #fff; border: 1px solid #e8e8e8; border-radius: 4px; font-size: 14px; line-height: 1.6;">
            ${fmt(application.projectIdea)}
        </div>

        <p style="margin: 12px 0 4px;"><strong>Additional Information:</strong></p>
        <div style="margin: 0 0 16px; padding: 10px 14px; background: #fff; border: 1px solid #e8e8e8; border-radius: 4px; font-size: 14px; line-height: 1.6;">
            ${fmt(application.additionalSkills) || '<em>Not provided</em>'}
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; margin: 0; text-align: center;">
            <a href="${process.env.SITE_URL || 'http://localhost:8080'}/admin" style="color: #7ec8e3;">View in Admin Dashboard</a>
        </p>
    </div>
</div>`;

        await transporter.sendMail({
            from: smtpFrom,
            to: notifyEmail,
            subject: `New E.E.L. Application: ${application.fullName}`,
            html: html,
            attachments: attachments
        });
        console.log('Notification email sent to ' + notifyEmail);
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
