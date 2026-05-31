import { getFriendlyErrorMessage } from "/Users/mani/Documents/Projects/intern/Intern-Manager/next-app/components/ui/ErrorAlert";

const testCases = [
  // 1. Raw codes
  { input: "CredentialsSignin", expected: "Invalid email or password." },
  { input: "Configuration", expected: "Authentication service unavailable." },
  { input: "AccessDenied", expected: "Access denied." },
  { input: "CallbackRouteError", expected: "Unable to complete sign in." },
  
  // 2. Clean messages
  { input: "Invalid email or password.", expected: "Invalid email or password." },
  { input: "Authentication service unavailable.", expected: "Authentication service unavailable." },
  { input: "Session expired. Please sign in again.", expected: "Session expired. Please sign in again." },
  { input: "Something went wrong. Please try again.", expected: "Something went wrong. Please try again." },

  // 3. Prisma/DB/internal error masking
  { input: "PrismaClientInitializationError: Can't reach database", expected: "Something went wrong. Please try again." },
  { input: "Database connection failed", expected: "Something went wrong. Please try again." },
  { input: "NextAuthSignInError", expected: "Something went wrong. Please try again." },
  { input: "Some unexpected error", expected: "Something went wrong. Please try again." },
  
  // Null / undefined / empty
  { input: "", expected: null },
  { input: null, expected: null },
  { input: undefined, expected: null },
];

let failed = false;
for (const tc of testCases) {
  const result = getFriendlyErrorMessage(tc.input);
  if (result !== tc.expected) {
    console.error(`FAIL: input "${tc.input}" -> got "${result}", expected "${tc.expected}"`);
    failed = true;
  } else {
    console.log(`PASS: input "${tc.input}" -> "${result}"`);
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log("All error mapper tests passed!");
}
