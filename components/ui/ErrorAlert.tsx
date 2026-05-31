"use client";

import React from "react";

interface ErrorAlertProps {
  error: string | null | undefined;
}

// 1. Replace raw error codes with user-friendly messages.
const errorMessages: Record<string, string> = {
  CredentialsSignin: "Invalid email or password.",
  Configuration: "Authentication service unavailable.",
  AccessDenied: "Access denied.",
  CallbackRouteError: "Unable to complete sign in.",
};

const cleanMessages = [
  "Invalid email or password.",
  "Access denied.",
  "Authentication service unavailable.",
  "Unable to complete sign in.",
  "Session expired. Please sign in again.",
  "Something went wrong. Please try again.",
  "Unable to sign in. Please try again."
];

export function getFriendlyErrorMessage(error: string | null | undefined): string | null {
  if (!error) return null;

  const trimmedError = error.trim();

  // If we have a direct mapping in errorMessages
  if (errorMessages[trimmedError]) {
    return errorMessages[trimmedError];
  }

  // If it matches one of our clean messages exactly, keep it
  if (cleanMessages.includes(trimmedError)) {
    return trimmedError;
  }

  // Check for any internal codes, prisma, database, connect errors, or trace details
  const lowercase = trimmedError.toLowerCase();
  if (
    lowercase.includes("prisma") ||
    lowercase.includes("database") ||
    lowercase.includes("sql") ||
    lowercase.includes("connect") ||
    lowercase.includes("fail") ||
    lowercase.includes("error") ||
    lowercase.includes("signin")
  ) {
    return "Something went wrong. Please try again.";
  }

  // Default fallback for raw identifiers or internal messages
  return "Something went wrong. Please try again.";
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  const friendlyMessage = getFriendlyErrorMessage(error);

  if (!friendlyMessage) return null;

  return (
    <div className="login-error">
      <span>⚠️</span>
      <span>{friendlyMessage}</span>
    </div>
  );
}
