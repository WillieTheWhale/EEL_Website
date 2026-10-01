/**
 * E.E.L. Collaboration / Support Forms
 * Shared client-side submission logic for collaboration.html and support.html
 */

(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        initSerialNumber();
        initCharCounters();
        initFormSubmission();
    }

    function initSerialNumber() {
        const el = document.getElementById('serialNumber');
        if (!el) return;

        let serial = sessionStorage.getItem('eel-inquiry-serial');
        if (!serial) {
            const chars = '0123456789ABCDEF';
            serial = '';
            for (let i = 0; i < 8; i++) {
                if (i === 4) serial += '-';
                serial += chars[Math.floor(Math.random() * chars.length)];
            }
            sessionStorage.setItem('eel-inquiry-serial', serial);
        }
        el.textContent = serial;
    }

    function initCharCounters() {
        document.querySelectorAll('textarea[data-counter]').forEach(function(textarea) {
            const count = document.getElementById(textarea.dataset.counter);
            if (!count) return;

            const update = function() {
                count.textContent = textarea.value.length;
                const max = parseInt(textarea.maxLength, 10);
                const ratio = max ? textarea.value.length / max : 0;
                count.style.color = ratio > 0.9 ? '#E53935' : ratio > 0.75 ? '#FF9A00' : '';
            };

            textarea.addEventListener('input', update);
            update();
        });
    }

    function initFormSubmission() {
        const form = document.getElementById('inquiryForm');
        const modal = document.getElementById('successModal');
        const refEl = document.getElementById('refId');
        const submitBtn = form?.querySelector('button[type="submit"]');

        if (!form) return;

        const defaultButtonText = submitBtn?.querySelector('span')?.textContent || 'SUBMIT';

        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const required = form.querySelectorAll('[required]');
            let valid = true;
            let firstInvalid = null;

            required.forEach(function(field) {
                const isValid = field.value.trim() !== '' && field.validity.valid;
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

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.querySelector('span').textContent = 'SUBMITTING...';
            }

            const payload = Object.fromEntries(new FormData(form).entries());
            payload.inquiryType = form.dataset.inquiryType;

            try {
                const response = await fetch('/api/inquiries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    if (refEl) refEl.textContent = result.reference;

                    if (modal) {
                        modal.classList.add('active');
                        document.body.style.overflow = 'hidden';
                    }

                    sessionStorage.setItem('eel-inquiry-ref', result.reference);
                } else {
                    alert('Submission failed: ' + (result.error || 'Unknown error'));

                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.querySelector('span').textContent = defaultButtonText;
                    }
                }
            } catch (err) {
                console.error('Submission error:', err);
                alert('Failed to submit the form. Please try again.');

                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.querySelector('span').textContent = defaultButtonText;
                }
            }
        });

        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }
    }
})();
