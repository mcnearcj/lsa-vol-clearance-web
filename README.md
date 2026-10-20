# Volunteer Clearance Tracker

A small web app that helps Diocese of Allentown volunteers track the Safe Environment requirements on the
[Parish & School Volunteer Requirements Checklist](docs/Background%20Check%20List%20Volunteer.pdf) and fill in the forms.

- **Checklist**: the 12 requirements with status, completion date, 5-year renewal reminders, and step-by-step instructions.
- **My info**: entered once, used to pre-fill the forms.
- **Forms**: Background Check Authorization, Sexual Abuse / Code of Conduct / Social Media / CPSL acknowledgments, and the NSOR application are generated as PDFs to print and sign.

## Privacy

Everything stays in the volunteer's browser (`localStorage`). There is no backend, and PDFs are filled in on the device.
The app never asks for or stores a Social Security Number; those fields are left blank on the generated forms.

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # static site in dist/
```

The built site is static and uses a relative base path, so `dist/` can be hosted anywhere (e.g. GitHub Pages).

## Files

- `docs/`: the diocese's original PDFs as supplied.
- `public/forms/`: copies the app serves (templates it fills in, plus instruction sheets for reference).
- `src/data/requirements.ts`: the checklist content. Update it when the diocese revises the checklist.
- `src/pdf/fill.ts`: PDF filling. Field positions are taken from the diocese's PDFs; the Social Media and CPSL acknowledgments are re-typeset because the originals are low-quality scans.
