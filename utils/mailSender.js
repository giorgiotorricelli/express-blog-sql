import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    }
});

function sendMail(to, subject, body) {
    return transporter.sendMail({
        from: process.env.SMTP_USERNAME,
        to,
        subject,
        html: body
    });
}

export {
    sendMail
}