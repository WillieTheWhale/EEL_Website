/**
 * E.E.L. Application Form
 * Submits to backend API
 */

(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        initSerialNumber();
        initFileUpload();
        initCharCounters();
        initFormSubmission();
    }

    // Generate session reference number
    function initSerialNumber() {
        const el = document.getElementById('serialNumber');
        if (!el) return;

        let serial = sessionStorage.getItem('eel-serial');
        if (!serial) {
            const chars = '0123456789ABCDEF';
            serial = '';
            for (let i = 0; i < 8; i++) {
                if (i === 4) serial += '-';
                serial += chars[Math.floor(Math.random() * chars.length)];
            }
            sessionStorage.setItem('eel-serial', serial);
        }
        el.textContent = serial;
    }

    // File upload handling
    function initFileUpload() {
        const input = document.getElementById('resume');
        const zone = document.getElementById('uploadZone');
        const selected = document.getElementById('uploadSelected');
        const content = zone?.querySelector('.upload-content');

        if (!input || !zone || !selected) return;

        // File selection
        input.addEventListener('change', () => handleFile(input.files[0]));

        // Drag and drop
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            zone.addEventListener(event, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        zone.addEventListener('dragenter', () => zone.classList.add('dragover'));
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => {
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                handleFile(e.dataTransfer.files[0]);
            }
        });

        function handleFile(file) {
            if (!file) {
                selected.textContent = '';
                if (content) content.style.display = '';
                return;
            }

            if (!file.name.toLowerCase().endsWith('.pdf')) {
                selected.textContent = 'ERROR: PDF files only';
                selected.style.color = '#E53935';
                selected.style.background = 'rgba(229, 57, 53, 0.1)';
                input.value = '';
                return;
            }

            if (file.size > 100 * 1024 * 1024) {
                selected.textContent = 'ERROR: File exceeds 100MB';
                selected.style.color = '#E53935';
                selected.style.background = 'rgba(229, 57, 53, 0.1)';
                input.value = '';
                return;
            }

            const size = (file.size / (1024 * 1024)).toFixed(2);
            selected.textContent = `${file.name} (${size} MB)`;
            selected.style.color = '';
            selected.style.background = '';
            if (content) content.style.display = 'none';
        }
    }

    // Character counters for textareas
    function initCharCounters() {
        const fields = [
            { input: 'contribution', counter: 'contribCount' },
            { input: 'projectIdea', counter: 'projectCount' },
            { input: 'additionalSkills', counter: 'skillsCount' }
        ];

        fields.forEach(({ input, counter }) => {
            const textarea = document.getElementById(input);
            const count = document.getElementById(counter);
            if (!textarea || !count) return;

            const update = () => {
                count.textContent = textarea.value.length;
                const max = parseInt(textarea.maxLength);
                const ratio = textarea.value.length / max;
                count.style.color = ratio > 0.9 ? '#E53935' : ratio > 0.75 ? '#FF9A00' : '';
            };

            textarea.addEventListener('input', update);
            update();
        });
    }

    // Form submission
    function initFormSubmission() {
        const form = document.getElementById('applicationForm');
        const modal = document.getElementById('successModal');
        const refEl = document.getElementById('refId');
        const submitBtn = form?.querySelector('button[type="submit"]');

        if (!form) return;

        form.addEventListener('submit', async e => {
            e.preventDefault();

            // Validate
            const required = form.querySelectorAll('[required]');
            let valid = true;
            let firstInvalid = null;

            required.forEach(field => {
                const isValid = field.type === 'file'
                    ? field.files.length > 0
                    : field.value.trim() !== '' && field.validity.valid;

                field.style.borderColor = isValid ? '' : '#E53935';

                if (!isValid && valid) {
                    valid = false;
                    firstInvalid = field;
                }
            });

            if (!valid && firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstInvalid.focus();
                return;
            }

            // Disable submit button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.querySelector('span').textContent = 'SUBMITTING...';
            }

            // Build FormData
            const formData = new FormData();
            formData.append('fullName', form.fullName.value);
            formData.append('pronouns', form.pronouns?.value || '');
            formData.append('email', form.email.value);
            formData.append('yearOfStudy', form.yearOfStudy.value);
            formData.append('major', form.major.value);
            formData.append('linkedin', form.linkedin?.value || '');
            formData.append('hours', form.hours.value);
            formData.append('contribution', form.contribution.value);
            formData.append('projectIdea', form.projectIdea.value);
            formData.append('additionalSkills', form.additionalSkills?.value || '');
            formData.append('resume', form.resume.files[0]);

            try {
                const response = await fetch('/api/applications', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // Update reference in modal
                    if (refEl) refEl.textContent = result.reference;

                    // Show success modal
                    if (modal) {
                        modal.classList.add('active');
                        document.body.style.overflow = 'hidden';
                    }

                    sessionStorage.setItem('eel-ref', result.reference);
                } else {
                    // Show error
                    alert('Submission failed: ' + (result.error || 'Unknown error'));

                    // Re-enable submit button
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.querySelector('span').textContent = 'SUBMIT APPLICATION';
                    }
                }
            } catch (err) {
                console.error('Submission error:', err);
                alert('Failed to submit application. Please try again.');

                // Re-enable submit button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.querySelector('span').textContent = 'SUBMIT APPLICATION';
                }
            }
        });

        // Close modal on background click
        if (modal) {
            modal.addEventListener('click', e => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }
    }

})();
