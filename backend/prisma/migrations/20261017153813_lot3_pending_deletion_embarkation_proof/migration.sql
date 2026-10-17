-- CreateTable
CREATE TABLE "Authority" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CI',
    "city" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Authority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "authorityId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokensRevokedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marin" (
    "id" TEXT NOT NULL,
    "authorityId" TEXT NOT NULL,
    "matricule" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "nationality" TEXT NOT NULL DEFAULT 'Ivoirienne',
    "idNumber" TEXT NOT NULL,
    "photoUrl" TEXT,
    "region" TEXT,
    "shipCategory" TEXT,
    "fonctionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "registrationSource" TEXT NOT NULL DEFAULT 'SELF_ONLINE',
    "isCadet" BOOLEAN NOT NULL DEFAULT false,
    "notifySms" BOOLEAN NOT NULL DEFAULT true,
    "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fonction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'PONT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fonction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "validityMonths" INTEGER,
    "requiresTraining" BOOLEAN NOT NULL DEFAULT false,
    "trainingDays" INTEGER,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateRequirement" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requiredTypeId" TEXT,
    "requiredSeaDays" INTEGER,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertificateRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "marinId" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "number" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "issuedPlace" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCANNED',
    "fileUrl" TEXT,
    "verificationCode" TEXT,
    "qrToken" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Embarkation" (
    "id" TEXT NOT NULL,
    "marinId" TEXT NOT NULL,
    "vesselName" TEXT NOT NULL,
    "imoNumber" TEXT,
    "flag" TEXT,
    "vesselType" TEXT,
    "fonctionId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "days" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DECLARED',
    "proofUrl" TEXT,
    "rejectReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Embarkation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingDeletion" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abandonedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbarkationProof" (
    "id" TEXT NOT NULL,
    "embarkationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbarkationProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmbarkationEvent" (
    "id" TEXT NOT NULL,
    "embarkationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbarkationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "marinId" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "feeAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "submittedById" TEXT,
    "submittedByRole" TEXT NOT NULL DEFAULT 'MARIN',
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "additionalInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenewalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestAttachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payerPhone" TEXT,
    "externalRef" TEXT,
    "receiptUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "authorityId" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "trainer" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "minQuorum" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'WAITING_FOR_QUORUM',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "marinId" TEXT NOT NULL,
    "certificateTypeId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "source" TEXT NOT NULL DEFAULT 'MARIN',
    "result" TEXT,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarinNotification" (
    "id" TEXT NOT NULL,
    "marinId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarinNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRVerificationLog" (
    "id" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "documentId" TEXT,
    "result" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Authority_code_key" ON "Authority"("code");

-- CreateIndex
CREATE INDEX "Authority_parentId_idx" ON "Authority"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- CreateIndex
CREATE INDEX "Agent_authorityId_idx" ON "Agent"("authorityId");

-- CreateIndex
CREATE INDEX "Agent_role_idx" ON "Agent"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Marin_matricule_key" ON "Marin"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Marin_phone_key" ON "Marin"("phone");

-- CreateIndex
CREATE INDEX "Marin_status_idx" ON "Marin"("status");

-- CreateIndex
CREATE INDEX "Marin_authorityId_idx" ON "Marin"("authorityId");

-- CreateIndex
CREATE INDEX "Marin_registrationSource_idx" ON "Marin"("registrationSource");

-- CreateIndex
CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Fonction_code_key" ON "Fonction"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateType_code_key" ON "CertificateType"("code");

-- CreateIndex
CREATE INDEX "CertificateRequirement_targetId_idx" ON "CertificateRequirement"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeSchedule_certificateTypeId_requestType_key" ON "FeeSchedule"("certificateTypeId", "requestType");

-- CreateIndex
CREATE UNIQUE INDEX "Document_verificationCode_key" ON "Document"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Document_replacedById_key" ON "Document"("replacedById");

-- CreateIndex
CREATE INDEX "Document_marinId_idx" ON "Document"("marinId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_expiryDate_idx" ON "Document"("expiryDate");

-- CreateIndex
CREATE INDEX "Embarkation_marinId_idx" ON "Embarkation"("marinId");

-- CreateIndex
CREATE INDEX "Embarkation_status_idx" ON "Embarkation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PendingDeletion_fileUrl_key" ON "PendingDeletion"("fileUrl");

-- CreateIndex
CREATE INDEX "PendingDeletion_nextAttemptAt_idx" ON "PendingDeletion"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "PendingDeletion_abandonedAt_idx" ON "PendingDeletion"("abandonedAt");

-- CreateIndex
CREATE INDEX "EmbarkationProof_embarkationId_idx" ON "EmbarkationProof"("embarkationId");

-- CreateIndex
CREATE INDEX "EmbarkationEvent_embarkationId_createdAt_idx" ON "EmbarkationEvent"("embarkationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalRequest_reference_key" ON "RenewalRequest"("reference");

-- CreateIndex
CREATE INDEX "RenewalRequest_marinId_idx" ON "RenewalRequest"("marinId");

-- CreateIndex
CREATE INDEX "RenewalRequest_status_idx" ON "RenewalRequest"("status");

-- CreateIndex
CREATE INDEX "RenewalRequest_assignedToId_idx" ON "RenewalRequest"("assignedToId");

-- CreateIndex
CREATE INDEX "RequestAttachment_requestId_idx" ON "RequestAttachment"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalRef_key" ON "Payment"("externalRef");

-- CreateIndex
CREATE INDEX "Payment_requestId_idx" ON "Payment"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSession_code_key" ON "TrainingSession"("code");

-- CreateIndex
CREATE INDEX "TrainingSession_certificateTypeId_idx" ON "TrainingSession"("certificateTypeId");

-- CreateIndex
CREATE INDEX "TrainingSession_status_idx" ON "TrainingSession"("status");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_marinId_idx" ON "TrainingEnrollment"("marinId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_status_idx" ON "TrainingEnrollment"("status");

-- CreateIndex
CREATE INDEX "MarinNotification_marinId_createdAt_idx" ON "MarinNotification"("marinId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "QRVerificationLog_verificationCode_idx" ON "QRVerificationLog"("verificationCode");

-- CreateIndex
CREATE INDEX "QRVerificationLog_createdAt_idx" ON "QRVerificationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Authority" ADD CONSTRAINT "Authority_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Authority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "Authority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marin" ADD CONSTRAINT "Marin_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "Authority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marin" ADD CONSTRAINT "Marin_fonctionId_fkey" FOREIGN KEY ("fonctionId") REFERENCES "Fonction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marin" ADD CONSTRAINT "Marin_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marin" ADD CONSTRAINT "Marin_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRequirement" ADD CONSTRAINT "CertificateRequirement_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "CertificateType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateRequirement" ADD CONSTRAINT "CertificateRequirement_requiredTypeId_fkey" FOREIGN KEY ("requiredTypeId") REFERENCES "CertificateType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_marinId_fkey" FOREIGN KEY ("marinId") REFERENCES "Marin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embarkation" ADD CONSTRAINT "Embarkation_marinId_fkey" FOREIGN KEY ("marinId") REFERENCES "Marin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embarkation" ADD CONSTRAINT "Embarkation_fonctionId_fkey" FOREIGN KEY ("fonctionId") REFERENCES "Fonction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embarkation" ADD CONSTRAINT "Embarkation_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbarkationProof" ADD CONSTRAINT "EmbarkationProof_embarkationId_fkey" FOREIGN KEY ("embarkationId") REFERENCES "Embarkation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbarkationEvent" ADD CONSTRAINT "EmbarkationEvent_embarkationId_fkey" FOREIGN KEY ("embarkationId") REFERENCES "Embarkation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalRequest" ADD CONSTRAINT "RenewalRequest_marinId_fkey" FOREIGN KEY ("marinId") REFERENCES "Marin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalRequest" ADD CONSTRAINT "RenewalRequest_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalRequest" ADD CONSTRAINT "RenewalRequest_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalRequest" ADD CONSTRAINT "RenewalRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalRequest" ADD CONSTRAINT "RenewalRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalRequest" ADD CONSTRAINT "RenewalRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestAttachment" ADD CONSTRAINT "RequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RenewalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RenewalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_authorityId_fkey" FOREIGN KEY ("authorityId") REFERENCES "Authority"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_marinId_fkey" FOREIGN KEY ("marinId") REFERENCES "Marin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_certificateTypeId_fkey" FOREIGN KEY ("certificateTypeId") REFERENCES "CertificateType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarinNotification" ADD CONSTRAINT "MarinNotification_marinId_fkey" FOREIGN KEY ("marinId") REFERENCES "Marin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRVerificationLog" ADD CONSTRAINT "QRVerificationLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
