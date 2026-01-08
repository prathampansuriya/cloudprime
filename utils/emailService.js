const createTransporter = require('../config/email');

const sendEmail = async (options) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        html: options.html
    };

    if (options.text) {
        mailOptions.text = options.text;
    }

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};

const sendVerificationOTP = async (user, otp) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .container { max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; }
                .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
                .content { padding: 30px; background: #f9f9f9; }
                .otp-box { background: #fff; border: 2px dashed #4F46E5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Email Verification</h1>
                </div>
                <div class="content">
                    <p>Hello ${user.name},</p>
                    <p>Thank you for registering with  CloudPrime! Use the OTP below to verify your email address:</p>
                    
                    <div class="otp-box">
                        ${otp}
                    </div>
                    
                    <div class="note">
                        <p><strong>Note:</strong> This OTP is valid for 10 minutes only.</p>
                    </div>
                    
                    <p>Enter this OTP on the verification page to complete your registration.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <p>Best regards,<br>The  CloudPrime Team</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()}  CloudPrime. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return await sendEmail({
        email: user.email,
        subject: 'Your  CloudPrime Verification OTP',
        html: html
    });
};

const sendPasswordResetEmail = async (user, token) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .container { max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; }
                .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
                .content { padding: 30px; background: #f9f9f9; }
                .button { background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset</h1>
                </div>
                <div class="content">
                    <p>Hello ${user.name},</p>
                    <p>You requested a password reset for your  CloudPrime account. Click the button below to reset your password:</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </p>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p>${resetUrl}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                    <p>Best regards,<br>The  CloudPrime Team</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()}  CloudPrime. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return await sendEmail({
        email: user.email,
        subject: 'Password Reset Request -  CloudPrime',
        html: html
    });
};

module.exports = {
    sendEmail,
    sendVerificationOTP,
    sendPasswordResetEmail
};