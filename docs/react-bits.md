# React Bits adaptations

Status Mark, Slosh Gauge and Swipe Row are adapted for EV Command from
[React Bits](https://github.com/DavidHDev/react-bits), retrieved 22 September 2026.
The copyright and license terms are retained in [licenses/react-bits.md](licenses/react-bits.md)
and distributed with the app at `/licenses/react-bits.txt`.

- Status Mark uses SVG/CSS transitions and the ledger's actual sync states; labels remain readable and are announced politely.
- Slosh Gauge keeps a small, damped liquid movement on value changes, uses existing colour tokens and exposes an exact kWh meter. It is read-only.
- Swipe Row keeps the existing edit/delete/Undo flow. Pointer gestures lock to an axis, preserve vertical scrolling and settle with a damped spring. An explicit action toggle supports keyboard and assistive technology. A full swipe never deletes a record.
- Reduced motion disables the new animation immediately. No new runtime packages are required.
