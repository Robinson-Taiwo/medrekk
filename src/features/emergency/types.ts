export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export interface EmergencyContact { name: string; phone: string; relationship: string }

export interface EmergencyProfileData {
  criticalAllergies: string[];
  criticalConditions: string[];
  criticalMedications: string[];
  implantedDevices: string[];
  importantWarnings: string[];
  bloodGroup?: string;
  emergencyContact?: EmergencyContact;
  verificationStatus: string;
  lastConfirmedAt?: string;
  verificationMethod?: string;
  verifiedAt?: string;
  verifiedByName?: string;
  verifiedByFacility?: string | null;
}

export const PROFILE_PATH = "/patients/me/emergency-profile";