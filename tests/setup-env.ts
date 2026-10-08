// Point every test at the dedicated test database and the in-memory email provider.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.EMAIL_PROVIDER = "memory";
process.env.ADMIN_EMAIL = "admin-test@boulboul.local";
process.env.EMAIL_FROM = "Boulboul Art Wall <no-reply@localhost>"; // independent of the developer's .env
process.env.APP_URL = "http://localhost:3000";
process.env.STORAGE_LOCAL_DIR = "./storage/test-uploads";
process.env.SESSION_SECRET ||= "test-secret-test-secret-test-secret-123";
