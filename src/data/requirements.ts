import type { GroupId, Requirement } from '../types'
import { site } from './site'

// Source: "Safe Environment Parish & School Volunteer Requirements Checklist" (Diocese of Allentown, rev. 2/14/2023)
// plus the diocese's step-by-step instruction sheets. Keep this in sync with those documents.

const forms = (file: string) => `forms/${file}`

export const requirements: Requirement[] = [
  {
    id: 'patch',
    number: 1,
    group: 'checks',
    title: 'PA State Police Criminal Record Check (PATCH)',
    summary: 'Pennsylvania State Police record check, done online and free for volunteers. Must be less than a year old when you hand it in.',
    time: 'Results are usually immediate',
    validYears: 5,
    links: [{ label: 'Pennsylvania Access To Criminal History (PATCH)', href: 'https://epatch.pa.gov/' }],
    steps: [
      'Go to the PATCH site and click “New Volunteer Record Check” on the main page. Volunteer checks are free.',
      'Fill in your information and submit the request.',
      'On the results screen, click the blue “Certification Form” link to open your official certificate. You’re not done until you open it. Print it or save it as a PDF.',
      'Give the printed certificate to your Local Safe Environment Coordinator (LSEC).',
      'Can’t do it online? Print the Background Check Authorization Form (Checklist #10, below) and email it to punger@allentowndiocese.org instead.',
      'Questions about PATCH: the State Police helpline is 1-888-783-7972.',
    ],
    form: { id: 'bgauth', label: 'Background Check Authorization Form' },
  },
  {
    id: 'childabuse',
    number: 2,
    group: 'checks',
    title: 'PA Child Abuse History Certificate',
    summary: 'Apply online through the state’s child welfare portal.',
    time: 'Results in about 2–3 weeks',
    validYears: 5,
    links: [
      { label: 'PA Child Welfare Portal (apply here)', href: 'https://www.compass.dhs.pa.gov/CWIS/Public/Home' },
      { label: 'State instructions for this clearance', href: 'https://www.pa.gov/services/dhs/request-a-child-abuse-history-clearance' },
    ],
    steps: [
      `Ask ${site.lsec.name}, your LSEC, for the free payment code.`,
      'Go to the PA Child Welfare Portal (link below) and click “Create an Individual Account”. Use Chrome or Firefox; people often have trouble with Safari. Create a Keystone ID (a username you will remember, e.g. lastname + first initial + middle initial). Write down your security questions and answers exactly.',
      'You will get two emails: your Keystone ID and a temporary password. Print the first one for your records.',
      'Log in with “Individual Login”, then “Access my Clearance”. Verify your identity by security question or emailed code.',
      'When asked what type of device you are using, choose “Public” (library/school) or “Private” (your own device).',
      'Set a permanent password and write it down. Log in again with it, accept the My Child Welfare Terms and Conditions, and click Continue.',
      'Click “Create a Clearance Application” → “Begin”. Parish employees choose “Individual 14 years or older applying for or holding a paid position…”; school employees (new hire or updating) choose “School employee governed by the public school code”. Volunteers choose the volunteer option shown on the page; a volunteer clearance cannot be used for employment.',
      'Enter all requested information. Include an email so you can get your result electronically. List everyone you have lived with in the last 25 years, even if you have not lived with them recently, so the application is not sent back. (Applicants under 18 in 1975 must list their parents or guardians.)',
      'Enter your payment code when asked, then click “Submit” and write down the application number.',
      'You should receive an email that the application was received, then an email when your clearance is ready (about 2–3 weeks if you used a mailed copy). If you get a letter asking for more information, reply as it directs.',
    ],
    references: [
      { label: 'Diocese instructions, page 1', file: forms('child-abuse-history-instructions-1.pdf') },
      { label: 'Diocese instructions, page 2', file: forms('child-abuse-history-instructions-2.pdf') },
    ],
  },
  {
    id: 'fbi',
    number: 3,
    group: 'checks',
    title: 'FBI Criminal (DHS) Fingerprint Background Check',
    summary: 'Fingerprinting appointment for volunteers 18 and older. Must be less than a year old when you hand it in.',
    time: 'Results about 2 weeks after fingerprinting',
    validYears: 5,
    links: [{ label: 'IdentoGO registration', href: 'https://uenroll.identogo.com' }],
    steps: [
      `Get the payment code from ${site.lsec.name}, your LSEC.`,
      'Go to the IdentoGO registration site and enter the Service Code for volunteers: 1KG6ZJ (employees use 1KG786).',
      'Choose “Schedule or Manage Appointment” and enter your personal information. Fields marked with a red * are required. Enter an email if you want a receipt.',
      'Employer information: Diocese of Allentown, United States, PO Box F, Allentown, Pennsylvania 18105-1538. When asked if your mailing address is the same as your residential address, choose NO, then enter your home address in the residential area.',
      'Enter your payment code (the first 5 characters match the service code).',
      'Pick a fingerprinting location by ZIP code and schedule an appointment. Print the confirmation and bring it to the appointment.',
      'At the appointment you will get a paper receipt. Give a copy to your LSEC and keep the original.',
      'About two weeks later you will receive your results. Open the email link on a computer, not your phone, because the one-time link only works once; save and print it. Bring the original to your LSEC.',
    ],
    references: [{ label: 'Diocese fingerprint instructions', file: forms('fingerprint-instructions.pdf') }],
  },
  {
    id: 'sexabuse',
    number: 4,
    group: 'sign',
    title: 'Sexual Abuse Policy Acknowledgment (2022)',
    summary: 'Read the 2022 policy, then sign the acknowledgment.',
    time: 'A few minutes',
    links: [
      { label: 'Read the policy', href: 'https://www.allentowndiocese.org/sites/default/files/2023-01/SexualAbusePolicy2022.pdf' },
    ],
    steps: [
      'Read the policy (link above) or attend a diocesan training presentation.',
      'Generate the form below. Your name and location are filled in.',
      'Print it, then sign and date it by hand. Give it to your LSEC.',
    ],
    form: { id: 'sexabuse', label: 'Sexual Abuse Policy Acknowledgment' },
  },
  {
    id: 'conduct',
    number: 5,
    group: 'sign',
    title: 'Code of Conduct Acknowledgment (2022)',
    summary: 'Read the 2022 Code of Conduct, then sign the acknowledgment.',
    time: 'A few minutes',
    links: [
      { label: 'Read the policy', href: 'https://www.allentowndiocese.org/sites/default/files/2023-01/CodeofConduct2022.pdf' },
    ],
    steps: [
      'Read the policy (link above) or attend a diocesan training presentation.',
      'Generate the form below. Your name and location are filled in.',
      'Print it, then sign and date it by hand. Give it to your LSEC.',
    ],
    form: { id: 'conduct', label: 'Code of Conduct Acknowledgment' },
  },
  {
    id: 'social',
    number: 6,
    group: 'sign',
    title: 'Social Media & Electronic Communications Acknowledgment',
    summary: 'Read the social media policy, then sign the consent form.',
    time: 'A few minutes',
    links: [
      {
        label: 'Read the policy',
        href: 'https://www.allentowndiocese.org/sites/default/files/2023-01/SocialMediaPolicy2022.pdf',
      },
    ],
    steps: [
      'Read the policy (link above).',
      'Generate the form below. Your name and location are filled in.',
      'Print it, then sign and date it by hand. Give it to your LSEC.',
    ],
    form: { id: 'social', label: 'Social Media Acknowledgment' },
    references: [{ label: 'Original scanned form', file: forms('social-media-original-scan.pdf') }],
  },
  {
    id: 'pgc',
    number: 7,
    group: 'training',
    title: 'Protecting God’s Children Certificate',
    summary: 'Online VIRTUS training. Only needed once.',
    links: [{ label: 'VIRTUS online', href: 'https://www.virtusonline.org/virtus/' }],
    steps: [
      'Go to VIRTUS online and select “First-Time Registrant” → “Begin the registration process”.',
      'Choose “Allentown, PA (Diocese)” from the dropdown. If asked whether you have previously registered with Virtus, choose “No” if you are not sure.',
      'Create a username and password and keep them for later. You must give an email address to do the virtual training.',
      'Fill in all items. Select the primary location you volunteer at, at least one primary role you perform there, and any additional roles. Do not select the location of your training session; you pick that later.',
      'Say “Yes” if you are associated with any other diocesan locations, otherwise “No”.',
      'Answer the four questions, print and read the documents on the next page, select “I have read and understand this document”, enter your name and today’s date, and continue.',
      'Choose “Online Training” (or “Online Spanish Training”) and click Continue. Answer whether you have attended a VIRTUS Protecting God’s Children session.',
      'On your home page open the “Protecting God’s Children Online Awareness Session 4.0” module and finish it.',
      'Close the window, click “Home” → “Training History”, then click the tiny Certificate icon. Print or email the certificate to the location you volunteer at. Turn off pop-up blockers if the certificate does not open.',
    ],
    references: [{ label: 'Diocese instructions', file: forms('protecting-gods-children-instructions.pdf') }],
  },
  {
    id: 'mandated',
    number: 8,
    group: 'training',
    title: 'Mandated Reporter Training Certificate',
    summary: 'Online course on recognizing and reporting child abuse.',
    time: '3 hours or more',
    validYears: 5,
    links: [
      { label: 'University of Pittsburgh (reportabusepa.pitt.edu)', href: 'https://www.reportabusepa.pitt.edu/PublicStudentSignUp.aspx' },
      { label: 'PA Family Support Alliance (pafsa.org)', href: 'https://pafsa.org/' },
    ],
    steps: [
      'Option 1: go to reportabusepa.pitt.edu, fill in the required fields, click “Submit” to create an account, log in on the “Welcome” tab, and complete the training (3-hour minimum).',
      'Option 2: go to pafsa.org → “Trainings & Programs” → “Mandated Reporter Training”, find an upcoming virtual session you can attend, fill in the required fields (marked *) and register. You will get the Zoom link by email.',
      'When you finish, print or take a picture of your certificate and give it to your supervisor or LSEC.',
      'Keep your login information; the training expires every 5 years.',
    ],
    references: [{ label: 'Diocese instructions', file: forms('mandated-reporter-instructions.pdf') }],
  },
  {
    id: 'cpsl',
    number: 9,
    group: 'sign',
    title: 'Child Protective Services Law (CPSL) Acknowledgment',
    summary: 'Read the Child Protective Services Law policy, then sign.',
    time: 'A few minutes',
    links: [],
    steps: [
      'Read the Child Protective Services Law policy and the flow chart for mandated reporters (open the original document below).',
      'Generate the acknowledgment form. Your name and location are filled in.',
      'Print it, then sign and date it by hand. Give it to your LSEC.',
    ],
    form: { id: 'cpsl', label: 'CPSL Acknowledgment Form' },
    references: [{ label: 'CPSL policy and flow chart (original scan)', file: forms('cpsl-policy-original-scan.pdf') }],
  },
  {
    id: 'bgauth',
    number: 10,
    group: 'sign',
    title: 'Signed Background Check Authorization Form',
    summary: 'Gives the diocese permission to run your background checks.',
    time: 'A few minutes',
    note: 'Social Security Number is for employees only. This site never stores it.',
    links: [],
    steps: [
      'Generate the form below. Your personal information is filled in.',
      'Print it, then sign and date it by hand.',
      'Give it to your LSEC, or send it to Janice Woolley, Audit & Training Supervisor, PO Box F, Allentown PA 18105. Your parish or school keeps a copy.',
    ],
    form: { id: 'bgauth', label: 'Background Check Authorization Form' },
  },
  {
    id: 'mvr',
    number: 11,
    group: 'driving',
    title: 'Motor Vehicle Report',
    summary: 'Only if you drive on behalf of your parish or school.',
    optional: true,
    links: [],
    steps: [
      'If you will not drive for the parish or school, mark this “Not applicable”.',
      'Otherwise, ask your LSEC for the “Request for Driver Information Form” and fill out parts C and E.',
      'Mail the original to: Diocese of Allentown Safe Environment Office, PO Box F, Allentown PA 18105-1538.',
    ],
  },
  {
    id: 'nsor',
    number: 12,
    group: 'checks',
    title: 'National Sex Offender Registry (NSOR) Check',
    summary: 'Mail or email a one-page application to the state. Free. Must be less than a year old when you hand it in.',
    time: 'Processing takes about 14 days',
    validYears: 5,
    note: 'The single-form download leaves the Social Security Number blank to write in by hand. “Sign all forms” can fill it in for you; it’s never stored.',
    links: [
      {
        label: 'PA DHS NSOR application (original)',
        href: 'https://www.dhs.pa.gov/KeepKidsSafe/Resources/Documents/NSOR.APPLICATION.05.02.22.pdf',
      },
    ],
    steps: [
      'Generate the form below. Your information is filled in and the “Volunteer” purpose box is checked.',
      'Print it, fill in your Social Security Number, and sign and date it. Or use “Sign all forms” to do all three on screen.',
      'Submit it one of three ways: mail to Clearance Verification Unit, ChildLine, Department of Human Services, PO Box 8170, Harrisburg, PA 17105-8170; or scan and email to RA-PWNSOR@pa.gov (subject: “NSOR Verification Applicant Last Name”); or hand deliver to the drop box at 2525 North 7th Street, Harrisburg, PA 17110.',
      'Keep a copy as proof of submission. Questions: Clearance Verification Unit, 877-371-5422.',
    ],
    form: { id: 'nsor', label: 'NSOR Application' },
  },
]

export const groups: { id: GroupId; title: string; intro: string }[] = [
  {
    id: 'checks',
    title: 'Background checks',
    intro: `Start these first. Some take a few weeks to come back. Ask ${site.lsec.name}, your LSEC, for the payment codes.`,
  },
  {
    id: 'sign',
    title: 'Read and sign',
    intro: 'Read each policy, download your filled-in form, then print, sign and date it by hand.',
  },
  {
    id: 'training',
    title: 'Training',
    intro: 'Online courses. Print or save each certificate when you finish.',
  },
  {
    id: 'driving',
    title: 'Only if you drive',
    intro: 'Skip this if you will not drive for your parish or school.',
  },
]

/** Requirements in the order the site shows them: grouped, then by the diocese's number. */
export const orderedRequirements: Requirement[] = groups.flatMap((g) => requirements.filter((r) => r.group === g.id))
