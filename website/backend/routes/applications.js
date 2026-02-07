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

// Helper: Send notification email
async function sendNotificationEmail(application) {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const notifyEmail = process.env.NOTIFY_EMAIL || 'wilk05@unc.edu';

    if (!emailUser || !emailPass) {
        console.log('Email credentials not configured, skipping notification');
        return;
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass
            }
        });

        await transporter.sendMail({
            from: emailUser,
            to: notifyEmail,
            subject: `New E.E.L. Application: ${application.fullName}`,
            html: `
                <h2>New Application Received</h2>
                <p><strong>Reference:</strong> ${application.reference}</p>
                <p><strong>Name:</strong> ${application.fullName}</p>
                <p><strong>Pronouns:</strong> ${application.pronouns || 'Not provided'}</p>
                <p><strong>Email:</strong> ${application.email}</p>
                <p><strong>Year of Study:</strong> ${application.yearOfStudy}</p>
                <p><strong>Major:</strong> ${application.major}</p>
                <p><strong>LinkedIn:</strong> ${application.linkedin || 'Not provided'}</p>
                <p><strong>Hours/Week:</strong> ${application.hours}</p>
                <hr>
                <h3>Contribution:</h3>
                <p>${application.contribution}</p>
                <h3>Project Idea:</h3>
                <p>${application.projectIdea}</p>
                <h3>Additional Skills:</h3>
                <p>${application.additionalSkills || 'Not provided'}</p>
                <hr>
                <p><strong>Resume:</strong> ${application.resumeFilename}</p>
                <p><strong>Submitted:</strong> ${application.submittedAt}</p>
                <p><a href="${process.env.SITE_URL || 'http://localhost:8080'}/admin">View in Admin Dashboard</a></p>
            `
        });
        console.log('Notification email sent successfully');
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
