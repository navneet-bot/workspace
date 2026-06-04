"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/hooks/useUIStore";
import { useSession } from "next-auth/react";
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Mail, 
  Phone, 
  User, 
  GraduationCap, 
  Briefcase, 
  FileText, 
  Check, 
  Clock, 
  ExternalLink,
  Notebook
} from "lucide-react";
import { updateTutorStatus, updateTutorDetails } from "@/app/actions/tutors";

interface StatusHistoryItem {
  status: string;
  timestamp: string;
  notes: string;
}

interface Tutor {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  gender: string;
  dob: string;
  location: string;
  profilePhoto: string;
  qualification: string;
  university: string;
  degree: string;
  specialization: string;
  gradYear: string;
  subject: string;
  experience: string;
  mode: string;
  occupation: string;
  prevInst: string;
  certifications: string;
  portfolio: string;
  linkedinUrl: string;
  resumeUrl: string;
  status: string;
  interviewNotes: string;
  statusHistory: string; // JSON
  createdAt: string;
  updatedAt: string;
}

const PIPELINE_STAGES = [
  "Applied",
  "Onboarded"
];

export function TutorProfileView({ tutor: initialTutor }: { tutor: Tutor }) {
  const router = useRouter();
  const { addToast } = useUIStore();
  const { data: session } = useSession();
  const [tutor, setTutor] = useState<Tutor>(initialTutor);
  const [notes, setNotes] = useState(tutor.interviewNotes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const role = (session?.user as any)?.role || "intern";
  const permissions = (session?.user as any)?.permissions || "";
  const hasPerm = (key: string) => role === "admin" || permissions.split(",").map((p: string) => p.trim()).includes(key);

  let historyList: StatusHistoryItem[] = [];
  try {
    historyList = JSON.parse(tutor.statusHistory || "[]");
  } catch (e) {}

  // Reverse list to show newest on top
  const sortedHistory = [...historyList].reverse();

  const handleSaveNotes = async () => {
    if (!hasPerm("manage_tutor_interviews")) {
      addToast("You don't have permission to manage tutor interviews", "error");
      return;
    }
    setIsSavingNotes(true);
    const res = await updateTutorDetails(tutor.id, { interviewNotes: notes });
    setIsSavingNotes(false);
    if (res.success && res.tutor) {
      setTutor(res.tutor as any);
      addToast("Interview notes saved successfully", "success");
    } else {
      addToast(`Error: ${res.error || "Failed to save"}`, "error");
    }
  };

  const handleStageChange = async (newStatus: string) => {
    if (!hasPerm("manage_tutor_interviews")) {
      addToast("You don't have permission to update tutor recruitment status", "error");
      return;
    }
    if (newStatus === tutor.status) return;
    
    setIsUpdatingStatus(true);
    addToast(`Updating status to "${newStatus}"...`, "info");
    
    const notesPrompt = prompt(`Enter optional status notes for stage "${newStatus}":`, `Moved to ${newStatus}`);
    const statusNotes = notesPrompt !== null ? notesPrompt : `Moved to ${newStatus}`;

    const res = await updateTutorStatus(tutor.id, newStatus, statusNotes);
    setIsUpdatingStatus(false);
    
    if (res.success && res.tutor) {
      setTutor(res.tutor as any);
      addToast(`Status updated to ${newStatus}`, "success");
    } else {
      addToast(`Error: ${res.error || "Failed to update"}`, "error");
    }
  };

  // Check where the tutor current status sits in the pipeline
  const currentStageIndex = PIPELINE_STAGES.indexOf(tutor.status);

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return isoString;
    }
  };

  const statusColorClass = (status: string) => {
    if (status === "Onboarded") return "text-jj-green bg-jj-green/10 border-jj-green/20";
    if (status === "Rejected") return "text-jj-red bg-jj-red/10 border-jj-red/20";
    if (status === "Inactive") return "text-jj-text-muted bg-white/5 border-white/10";
    return "text-jj-accent bg-jj-accent/10 border-jj-accent/20";
  };

  return (
    <div className="flex flex-col pb-10" style={{ gap: "20px" }}>
      
      {/* Header and Back Link */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.push("/dashboard/tutors")}
          className="btn-sm btn-outline flex items-center gap-[6px]"
        >
          <ArrowLeft size={14} /> Back to Tutors List
        </button>

        <div className="flex items-center gap-2">
          {hasPerm("manage_tutor_interviews") && tutor.status !== "Rejected" && (
            <button 
              onClick={() => handleStageChange("Rejected")}
              className="action-btn action-reject px-3 py-1.5 font-bold"
            >
              ❌ Reject Tutor
            </button>
          )}
          {hasPerm("manage_tutor_interviews") && tutor.status !== "Inactive" && (
            <button 
              onClick={() => handleStageChange("Inactive")}
              className="action-btn action-edit px-3 py-1.5 font-bold"
            >
              ⏸️ Mark Inactive
            </button>
          )}
        </div>
      </div>

      {/* Profile Summary Card */}
      <div className="table-card flex flex-col md:flex-row items-center md:items-start" style={{ padding: "24px", gap: "24px" }}>
        {tutor.profilePhoto ? (
          <img 
            src={tutor.profilePhoto} 
            alt={tutor.name}
            className="w-24 h-24 rounded-2xl object-cover border-2 border-jj-border"
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-white/5 border border-jj-border flex items-center justify-center text-[28px] font-bold text-jj-text-soft">
            {tutor.name.substring(0, 2).toUpperCase()}
          </div>
        )}

        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
            <h2 className="text-[20px] font-bold font-syne text-jj-text leading-tight">{tutor.name}</h2>
            <span className={`badge border text-[11.5px] font-bold capitalize px-2 py-0.5 rounded-full ${statusColorClass(tutor.status)}`}>
              {tutor.status}
            </span>
          </div>

          <p className="text-[13px] text-jj-text-muted mt-1.5 font-medium flex items-center justify-center md:justify-start gap-1">
            <Briefcase size={13} className="text-jj-accent" /> {tutor.occupation || "Independent Tutor"}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start mt-4 text-[12.5px] text-jj-text-soft" style={{ columnGap: "24px", rowGap: "8px" }}>
            {tutor.email && (
              <a href={`mailto:${tutor.email}`} className="flex items-center gap-1.5 hover:text-jj-accent transition-colors">
                <Mail size={13} /> {tutor.email}
              </a>
            )}
            {tutor.phone && (
              <a href={`tel:${tutor.phone}`} className="flex items-center gap-1.5 hover:text-jj-accent transition-colors">
                <Phone size={13} /> {tutor.phone}
              </a>
            )}
            {tutor.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {tutor.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: "24px" }}>
        
        {/* Left Column - Tutor Details Cards (Basic, Academics, Teaching) */}
        <div className="lg:col-span-2 flex flex-col" style={{ gap: "24px" }}>
          
          {/* Card 1: Academic Background */}
          <div className="table-card" style={{ padding: "24px" }}>
            <h3 className="text-[14px] font-bold text-jj-accent uppercase tracking-wider mb-4 border-b border-jj-border pb-1.5 flex items-center gap-2">
              <GraduationCap size={15} /> Academic Background
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 text-[13px]" style={{ columnGap: "24px", rowGap: "16px" }}>
              <div>
                <span className="text-jj-text-muted block">Highest Qualification</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.qualification || "—"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">University / Board</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.university || "—"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">Degree</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.degree || "—"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">Specialization / Major</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.specialization || "—"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">Graduation Year</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.gradYear || "—"}</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Teaching Information */}
          <div className="table-card" style={{ padding: "24px" }}>
            <h3 className="text-[14px] font-bold text-jj-accent uppercase tracking-wider mb-4 border-b border-jj-border pb-1.5 flex items-center gap-2">
              <BookOpenIcon size={15} /> Teaching Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 text-[13px]" style={{ columnGap: "24px", rowGap: "16px" }}>
              <div>
                <span className="text-jj-text-muted block">Expertise Subjects</span>
                <strong className="text-jj-text mt-0.5 block text-jj-accent">{tutor.subject || "—"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">Teaching Mode</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.mode || "Online"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">Teaching Experience</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.experience || "—"}</strong>
              </div>
            </div>
          </div>

          {/* Card 3: Professional & Resume Links */}
          <div className="table-card" style={{ padding: "24px" }}>
            <h3 className="text-[14px] font-bold text-jj-accent uppercase tracking-wider mb-4 border-b border-jj-border pb-1.5 flex items-center gap-2">
              <FileText size={15} /> Professional details & CV
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 text-[13px]" style={{ columnGap: "24px", rowGap: "16px" }}>
              <div>
                <span className="text-jj-text-muted block">Current Occupation</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.occupation || "—"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">Previous Institutions</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.prevInst || "—"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">Teaching Certifications</span>
                <strong className="text-jj-text mt-0.5 block">{tutor.certifications || "—"}</strong>
              </div>
              <div>
                <span className="text-jj-text-muted block">Portfolio Profile</span>
                {tutor.portfolio ? (
                  <a 
                    href={tutor.portfolio} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-jj-accent hover:underline flex items-center gap-1 mt-0.5"
                  >
                    View Portfolio <ExternalLink size={12} />
                  </a>
                ) : (
                  <strong className="text-jj-text mt-0.5 block">—</strong>
                )}
              </div>
              <div>
                <span className="text-jj-text-muted block">LinkedIn Profile</span>
                {tutor.linkedinUrl ? (
                  <a 
                    href={tutor.linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-jj-accent hover:underline flex items-center gap-1 mt-0.5"
                  >
                    View LinkedIn <ExternalLink size={12} />
                  </a>
                ) : (
                  <strong className="text-jj-text mt-0.5 block">—</strong>
                )}
              </div>
              <div>
                <span className="text-jj-text-muted block">Resume / CV Link</span>
                {tutor.resumeUrl ? (
                  <a 
                    href={tutor.resumeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-jj-accent hover:underline flex items-center gap-1 mt-0.5"
                  >
                    Open Resume Document <ExternalLink size={12} />
                  </a>
                ) : (
                  <strong className="text-jj-text mt-0.5 block">—</strong>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column - Interview Notes & Status History Logs */}
        <div className="flex flex-col" style={{ gap: "24px" }}>
          
          {/* Interview Notes Card */}
          <div className="table-card flex flex-col" style={{ padding: "24px", gap: "16px" }}>
            <h3 className="text-[14px] font-bold text-jj-accent uppercase tracking-wider border-b border-jj-border pb-1.5 flex items-center gap-2">
              <Notebook size={15} /> Interview Evaluation Notes
            </h3>
            
            <textarea
              className="field-textarea"
              style={{ minHeight: "140px" }}
              placeholder="Write evaluations notes, scheduling info, demo feedback, qualifications assessments here..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={!hasPerm("manage_tutor_interviews")}
            />

            {hasPerm("manage_tutor_interviews") && (
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="btn-sm btn-accent self-end"
              >
                {isSavingNotes ? "Saving Notes..." : "✓ Save Notes"}
              </button>
            )}
          </div>

          {/* Status History Logs */}
          <div className="table-card" style={{ padding: "24px" }}>
            <h3 className="text-[14px] font-bold text-jj-accent uppercase tracking-wider mb-4 border-b border-jj-border pb-1.5 flex items-center gap-2">
              <Clock size={15} /> Status Audit History
            </h3>

            <div className="flex flex-col max-h-[300px] overflow-y-auto pr-1" style={{ gap: "16px" }}>
              {sortedHistory.length === 0 ? (
                <div className="text-[12px] text-jj-text-muted text-center py-4">No audit logs logged.</div>
              ) : (
                sortedHistory.map((h, i) => (
                  <div key={i} className="flex gap-3 text-[12px]">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-jj-accent" />
                      {i < sortedHistory.length - 1 && <div className="w-0.5 flex-1 bg-jj-border my-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-jj-text font-bold">{h.status}</strong>
                        <span className="text-[10px] text-jj-text-muted">{formatDateTime(h.timestamp)}</span>
                      </div>
                      <p className="text-jj-text-soft mt-0.5 break-words">{h.notes}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
      
    </div>
  );
}

// Inline fallback for BookOpen icon from Lucide since we didn't import it
function BookOpenIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
