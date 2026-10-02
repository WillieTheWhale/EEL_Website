/**
 * E.E.L. Collaboration / Support Inquiry API
 * Handles collaboration and support form submissions.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const NOTIFICATION_EMAILS = ['wilk05@unc.edu', 'mahaney@cs.unc.edu'];

const dataDir = path.join(__dirname, '../data');
const inquiriesFile = path.join(dataDir, 'inquiries.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(inquiriesFile)) {
    fs.writeFileSync(inquiriesFile, '[]', 'utf8');
}

function loadInquiries() {
    try {
        return JSON.parse(fs.readFileSync(inquiriesFile, 'utf8'));
    } catch (err) {
        return [];
    }
}

function saveInquiries(inquiries) {
    fs.writeFileSync(inquiriesFile, JSON.stringify(inquiries, null, 2), 'utf8');
}

function createMailTransporter() {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT, 10) || 587;

    if (smtpHost) {
        const opts = {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            tls: { rejectUnauthorized: false }
        };

        if (emailUser && emailPass) {
            opts.auth = { user: emailUser, pass: emailPass };
        }

        return nodemailer.createTransport(opts);
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass }
    });
}

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function fmt(str) {
    return esc(str).replace(/\n/g, '<br>');
}

async function sendNotificationEmail(inquiry) {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const smtpHost = process.env.SMTP_HOST;
    const smtpFrom = process.env.SMTP_FROM || emailUser;

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

        const submittedDate = new Date(inquiry.submittedAt).toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        const isCollaboration = inquiry.inquiryType === 'collaboration';
        const typeLabel = isCollaboration ? 'Collaboration' : 'Support';
        const subject = `New EEL ${typeLabel.toLowerCase()} inquiry - ${inquiry.fullName}`;

        const commonRows = `
            <tr><td style="padding:5px 12px 5px 0; width:170px; color:#52606d; font-weight:700;">Full name</td><td style="padding:5px 0;">${esc(inquiry.fullName)}</td></tr>
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Email</td><td style="padding:5px 0;"><a href="mailto:${esc(inquiry.email)}" style="color:#0056a6;">${esc(inquiry.email)}</a></td></tr>
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Organization</td><td style="padding:5px 0;">${esc(inquiry.organization) || 'Not provided'}</td></tr>
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Website</td><td style="padding:5px 0;">${inquiry.website ? `<a href="${esc(inquiry.website)}" style="color:#0056a6;">${esc(inquiry.website)}</a>` : 'Not provided'}</td></tr>
        `;

        const detailRows = isCollaboration
            ? `
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Role</td><td style="padding:5px 0;">${esc(inquiry.role) || 'Not provided'}</td></tr>
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Primary area</td><td style="padding:5px 0;">${esc(inquiry.collaborationType)}</td></tr>
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Project stage</td><td style="padding:5px 0;">${esc(inquiry.projectStage)}</td></tr>
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Timeframe</td><td style="padding:5px 0;">${esc(inquiry.timeframe) || 'Not provided'}</td></tr>
            `
            : `
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Support type</td><td style="padding:5px 0;">${esc(inquiry.supportType)}</td></tr>
            <tr><td style="padding:5px 12px 5px 0; color:#52606d; font-weight:700;">Approximate value</td><td style="padding:5px 0;">${esc(inquiry.estimatedValue) || 'Not provided'}</td></tr>
            `;

        const narrative = isCollaboration
            ? `
            <p style="margin:14px 0 4px; color:#52606d; font-weight:700;">What they would like to work with the EEL on</p>
            <p style="margin:0;">${fmt(inquiry.summary)}</p>
            `
            : `
            <p style="margin:14px 0 4px; color:#52606d; font-weight:700;">What they are interested in supporting</p>
            <p style="margin:0;">${fmt(inquiry.interest)}</p>
            `;

        const html = `<!doctype html>
<html lang="en"><body style="margin:0; padding:0; background:#f5f6f7; color:#1f2933; font-family:Arial, Helvetica, sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f6f7;"><tr><td align="center" style="padding:28px 16px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:640px; background:#ffffff; border:1px solid #d9dee3;">
<tr><td style="height:6px; background:#4b9cd3;"></td></tr>
<tr><td style="padding:28px 32px 22px; border-bottom:1px solid #d9dee3;"><p style="margin:0 0 6px; color:#13294b; font-size:21px; font-weight:700;">Experimental Engineering Lab</p><p style="margin:0; color:#52606d; font-size:14px;">University of North Carolina at Chapel Hill</p></td></tr>
<tr><td style="padding:28px 32px 8px;"><h1 style="margin:0 0 10px; color:#13294b; font-size:20px; line-height:1.3;">New ${typeLabel.toLowerCase()} inquiry</h1><p style="margin:0; color:#52606d; font-size:14px; line-height:1.5;">Reference ${esc(inquiry.reference)} &middot; Submitted ${submittedDate}</p></td></tr>
<tr><td style="padding:12px 32px 8px;"><h2 style="margin:0; padding-bottom:8px; color:#13294b; font-size:16px; border-bottom:1px solid #d9dee3;">Contact information</h2></td></tr>
<tr><td style="padding:0 32px 14px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size:14px; line-height:1.5;">
${commonRows}${detailRows}
</table></td></tr>
<tr><td style="padding:12px 32px 8px;"><h2 style="margin:0; padding-bottom:8px; color:#13294b; font-size:16px; border-bottom:1px solid #d9dee3;">Details</h2></td></tr>
<tr><td style="padding:0 32px 28px; font-size:14px; line-height:1.55;">
${narrative}
<p style="margin:18px 0 4px; color:#52606d; font-weight:700;">Additional information</p>
<p style="margin:0;">${fmt(inquiry.additionalInfo) || 'Not provided'}</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

        const textLines = [
            'Experimental Engineering Lab',
            'University of North Carolina at Chapel Hill',
            '',
            `New ${typeLabel.toLowerCase()} inquiry`,
            `Reference: ${inquiry.reference}`,
            `Submitted: ${submittedDate}`,
            '',
            `Full name: ${inquiry.fullName}`,
            `Email: ${inquiry.email}`,
            `Organization: ${inquiry.organization || 'Not provided'}`,
            `Website: ${inquiry.website || 'Not provided'}`
        ];

        if (isCollaboration) {
            textLines.push(
                `Role: ${inquiry.role || 'Not provided'}`,
                `Primary area: ${inquiry.collaborationType}`,
                `Project stage: ${inquiry.projectStage}`,
                `Timeframe: ${inquiry.timeframe || 'Not provided'}`,
                '',
                'What they would like to work with the EEL on:',
                inquiry.summary
            );
        } else {
            textLines.push(
                `Support type: ${inquiry.supportType}`,
                `Approximate value: ${inquiry.estimatedValue || 'Not provided'}`,
                '',
                'What they are interested in supporting:',
                inquiry.interest
            );
        }

        textLines.push(
            '',
            'Additional information:',
            inquiry.additionalInfo || 'Not provided'
        );

        const deliveryResults = await Promise.allSettled(
            NOTIFICATION_EMAILS.map((recipient) => transporter.sendMail({
                from: `"Experimental Engineering Lab" <${smtpFrom}>`,
                to: recipient,
                subject,
                text: textLines.join('\n'),
                html
            }))
        );
        deliveryResults.forEach((result, index) => {
            const recipient = NOTIFICATION_EMAILS[index];
            if (result.status === 'fulfilled') {
                console.log(`Inquiry notification email sent to: ${recipient}`);
            } else {
                console.error(`Failed to send inquiry notification email to ${recipient}:`, result.reason.message);
            }
        });
    } catch (err) {
        console.error('Failed to send inquiry notification email:', err.message);
    }
}

router.post('/', async (req, res) => {
    try {
        const inquiryType = req.body.inquiryType;
        const fullName = (req.body.fullName || '').trim();
        const email = (req.body.email || '').trim();

        if (!['collaboration', 'support'].includes(inquiryType)) {
            return res.status(400).json({ error: 'Invalid inquiry type' });
        }

        if (!fullName || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (inquiryType === 'collaboration') {
            if (!req.body.organization || !req.body.collaborationType || !req.body.projectStage || !req.body.summary) {
                return res.status(400).json({ error: 'Missing required collaboration fields' });
            }
        }

        if (inquiryType === 'support') {
            if (!req.body.supportType || !req.body.interest) {
                return res.status(400).json({ error: 'Missing required support fields' });
            }
        }

        const referencePrefix = inquiryType === 'collaboration' ? 'EEL-C' : 'EEL-S';
        const reference = referencePrefix + '-' + Date.now().toString(36).toUpperCase()
            + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

        const inquiry = {
            id: Date.now().toString(),
            reference,
            inquiryType,
            fullName,
            email,
            organization: (req.body.organization || '').trim(),
            role: (req.body.role || '').trim(),
            website: (req.body.website || '').trim(),
            collaborationType: (req.body.collaborationType || '').trim(),
            projectStage: (req.body.projectStage || '').trim(),
            timeframe: (req.body.timeframe || '').trim(),
            summary: (req.body.summary || '').trim(),
            supportType: (req.body.supportType || '').trim(),
            estimatedValue: (req.body.estimatedValue || '').trim(),
            interest: (req.body.interest || '').trim(),
            additionalInfo: (req.body.additionalInfo || '').trim(),
            submittedAt: new Date().toISOString(),
            status: 'new'
        };

        const inquiries = loadInquiries();
        inquiries.push(inquiry);
        saveInquiries(inquiries);

        console.log(`New ${inquiryType} inquiry received: ${reference} from ${fullName}`);

        await sendNotificationEmail(inquiry);

        res.status(201).json({
            success: true,
            reference,
            message: 'Inquiry submitted successfully'
        });
    } catch (err) {
        console.error('Error processing inquiry:', err);
        res.status(500).json({ error: 'Failed to process inquiry' });
    }
});

module.exports = router;
