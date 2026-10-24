import type { GroupId, Requirement } from '../types'

// The items volunteers track one by one: background checks, trainings and the driver form. The six signable forms
// are in forms.ts. Sources: the diocese's "Safe Environment School Volunteer Requirements Checklist" (rev. 7/31/2025,
// from its Safe Environment Requirements page) and its step-by-step instruction sheets. Keep this in sync with them.

const forms = (file: string) => `forms/${file}`
/** Where the diocese's Safe Environment page links its policies and forms. */
export const diocese = (file: string) => `https://adtoday.nyc3.digitaloceanspaces.com/${file}`

export const requirements: Requirement[] = [
  {
    id: 'patch',
    number: 1,
    group: 'checks',
    title: 'PA State Police Criminal Record Check (PATCH)',
    handIn: 'Printed PATCH certificate (the “Certification Form”), less than a year old',
    summary: 'Pennsylvania State Police record check, done online and free for volunteers. Must be less than a year old when you hand it in.',
    time: 'Results are usually immediate',
    validYears: 5,
    links: [
      { label: 'Pennsylvania Access To Criminal History (PATCH)', href: 'https://epatch.pa.gov/' },
      { label: 'Diocese background check policy', href: diocese('backgroundcheckpolicy-1.pdf') },
    ],
    steps: [
      'Go to the PATCH site and click “New Volunteer Record Check” on the main page. Volunteer checks are free.',
      'Fill in your information and submit the request. It asks for your Social Security Number; it isn’t required, but it’s recommended.',
      'On the results screen, click the blue “Certification Form” link to open your official certificate. You’re not done until you open it. Print it or save it as a PDF.',
      'Give the printed certificate to your Local Safe Environment Coordinator (LSEC).',
      'Can’t do it online? Make the Background Check Authorization Form under “Forms to sign”, sign it, and email it to punger@allentowndiocese.org instead.',
      'Questions about PATCH: the State Police helpline is 1-888-783-7972.',
    ],
    form: 'bgauth',
  },
  {
    id: 'childabuse',
    number: 2,
    group: 'checks',
    title: 'PA Child Abuse History Certificate',
    handIn: 'PA Child Abuse History Certificate',
    summary: 'Apply online through the state’s child welfare portal.',
    time: 'Results in about 2–3 weeks',
    validYears: 5,
    links: [
      { label: 'PA Child Welfare Portal (apply here)', href: 'https://www.compass.dhs.pa.gov/CWIS/Public/Home' },
      { label: 'State instructions for this clearance', href: 'https://www.pa.gov/services/dhs/request-a-child-abuse-history-clearance' },
    ],
    steps: [
      'Ask {lsec}, your LSEC, for the free payment code.',
      'Go to the PA Child Welfare Portal (link below) and click “Create an Individual Account”. Use Chrome or Firefox; people often have trouble with Safari. Create a Keystone ID (a username you will remember, e.g. lastname + first initial + middle initial). Write down your security questions and answers exactly.',
      'You will get two emails: your Keystone ID and a temporary password. Print the first one for your records.',
      'Log in with “Individual Login”, then “Access my Clearance”. Verify your identity by security question or emailed code.',
      'When asked what type of device you are using, choose “Public” (library/school) or “Private” (your own device).',
      'Set a permanent password and write it down. Log in again with it, accept the My Child Welfare Terms and Conditions, and click Continue.',
      'Click “Create a Clearance Application” → “Begin”. Parish employees choose “Individual 14 years or older applying for or holding a paid position…”; school employees (new hire or updating) choose “School employee governed by the public school code”. Volunteers choose the volunteer option shown on the page; a volunteer clearance cannot be used for employment.',
      'Enter all requested information. Include your Social Security Number, or your results will take longer. Include an email so you can get your result electronically. List everyone you have lived with in the last 25 years, even if you have not lived with them recently, so the application is not sent back. (Applicants under 18 in 1975 must list their parents or guardians.)',
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
    handIn: 'Original FBI fingerprint results letter, less than a year old',
    summary: 'Fingerprinting appointment for volunteers 18 and older. Must be less than a year old when you hand it in.',
    time: 'Results about 2 weeks after fingerprinting',
    validYears: 5,
    links: [{ label: 'IdentoGO registration', href: 'https://uenroll.identogo.com' }],
    steps: [
      'Get the payment code from {lsec}, your LSEC.',
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
    id: 'pgc',
    number: 7,
    group: 'training',
    title: 'Protecting God’s Children Certificate',
    handIn: 'Protecting God’s Children certificate of completion',
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
    handIn: 'Mandated Reporter Training certificate',
    summary: 'Online course on recognizing and reporting child abuse.',
    time: '3 hours or more',
    validYears: 5,
    links: [
      { label: 'University of Pittsburgh (reportabusepa.pitt.edu)', href: 'https://www.reportabusepa.pitt.edu/PublicStudentSignUp.aspx' },
      { label: 'En español: Universidad de Pittsburgh', href: 'https://www.reportabusepa.pitt.edu/LoginES.aspx' },
      { label: 'PA Family Support Alliance (pafsa.org)', href: 'https://pafsa.org/' },
    ],
    steps: [
      'Option 1, online any time: go to reportabusepa.pitt.edu, fill in the required (blue) fields and click “Submit” to create a username and password, log in on the “Welcome” tab, and complete the training (3 hours minimum). A Spanish version is linked below.',
      'Option 2, live on Zoom: go to pafsa.org → “Trainings & Programs” → “Mandated Reporter Training”, scroll to “Upcoming Virtual Sessions at no cost”, pick a date and time, fill in the required fields (marked *) and click “Register”. You’ll get the Zoom link by email. The certificate can take up to two weeks to arrive by email.',
      'When you finish, print or take a picture of your certificate and give it to your supervisor or LSEC.',
      'Keep your login information; the training expires every 5 years.',
    ],
    references: [{ label: 'Diocese instructions', file: forms('mandated-reporter-instructions.pdf') }],
  },
  {
    id: 'mvr',
    number: 11,
    group: 'driving',
    title: 'Motor Vehicle Report',
    handIn: 'Request for Driver Information Form (parts C and E)',
    summary: 'Only if you drive on behalf of your parish or school.',
    optional: true,
    handInDetail: 'Ask your LSEC for the form. Mail the original to the Diocese of Allentown Safe Environment Office, PO Box F, Allentown PA 18105-1538.',
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
    handIn: 'NSOR verification letter from the state, less than a year old',
    summary: 'Mail or email a one-page application to the state. Free. Must be less than a year old when you hand it in.',
    time: 'Processing takes about 14 days',
    validYears: 5,
    note: 'You can add your Social Security Number when you make your forms, or write it on the printed form. The site never stores it.',
    handInDetail: 'The state mails or emails this after you send the NSOR application.',
    links: [
      {
        label: 'PA DHS NSOR application, CY 1001 (original)',
        href: 'https://www.pa.gov/content/dam/copapwp-pagov/en/dhs/documents/keepkidssafe/resources/documents/2024-06-14-cy-1001-national-sex-offender-registry-nsor-application-english.pdf',
      },
    ],
    steps: [
      'Make the application under “Forms to sign” on this page. Your information is filled in and the “Volunteer” purpose box is checked. You can add your Social Security Number and signature there, or write them on the printed form.',
      'Submit it one of three ways: mail to Clearance Verification Unit, ChildLine, Department of Human Services, PO Box 8170, Harrisburg, PA 17105-8170; or scan and email to RA-PWNSOR@pa.gov (subject: “NSOR Verification Applicant Last Name”); or hand deliver to the drop box at 2525 North 7th Street, Harrisburg, PA 17110.',
      'Keep a copy as proof of submission. The state emails your verification letter (encrypted) in about 14 days; give a copy to your LSEC. Questions: Clearance Verification Unit, 877-371-5422.',
    ],
    form: 'nsor',
  },
]

export const groups: { id: GroupId; title: string; intro: string }[] = [
  {
    id: 'checks',
    title: 'Background checks',
    intro: 'Start these first. Some take a few weeks to come back. Ask {lsec}, your LSEC, for the payment codes.',
  },
  {
    id: 'sign',
    title: 'Forms to sign',
    intro: 'Read each policy, then make your forms. They’re filled in with your info. Sign them on screen, or print and sign by hand, then give them to {lsec}.',
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

/** Tracked items in the order the site shows them: by group, then by the diocese's number. */
export const orderedRequirements: Requirement[] = groups.flatMap((g) => requirements.filter((r) => r.group === g.id))
