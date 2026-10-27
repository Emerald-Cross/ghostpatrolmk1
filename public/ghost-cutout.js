// One broad scissor-friendly silhouette. Its QR canvas stays entirely inside the body.
export const GHOST_CUTLINE = 'M140 365C142 180 205 38 380 38C550 38 618 180 620 365C650 320 675 290 711 310C745 332 733 380 704 420L678 463C702 630 694 765 722 917C674 932 655 966 615 951C574 931 574 917 536 943C496 972 468 958 438 936C405 914 390 963 354 962C313 960 312 928 278 935C241 940 230 969 192 950C158 930 146 937 120 952C81 975 62 932 35 925C74 766 58 615 82 463L57 420C25 383 13 333 47 313C82 294 110 326 140 365Z';
export function ghostCutout(number) {
  if (!Number.isInteger(number) || number < 1 || number > 18) throw new Error('Choose a known ghost target.');
  const mouth = number % 3 === 0 ? '<ellipse cx="380" cy="272" rx="19" ry="25"/>' : number % 3 === 1 ? '<path d="M338 254Q380 303 422 254Q380 326 338 254Z"/>' : '<path d="m336 267 22 15 22-15 22 15 22-15" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>';
  return `<svg class="ghost-cutout" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 990" role="img" aria-label="Ghost ${number}, cut along the outer ghost outline">
    <path class="cut-line" d="${GHOST_CUTLINE}" fill="white" stroke="#3b3b44" stroke-width="2.5" stroke-dasharray="8 6" stroke-linejoin="round"/>
    <g fill="#25252d" color="#25252d"><ellipse cx="299" cy="210" rx="24" ry="42" transform="rotate(-12 299 210)"/><ellipse cx="461" cy="210" rx="24" ry="42" transform="rotate(12 461 210)"/>${mouth}</g>
    <path d="M116 483Q90 686 105 824M644 483Q670 686 655 824" fill="none" stroke="#bdbdc4" stroke-width="2" stroke-linecap="round"/>
    <text x="380" y="353" text-anchor="middle" font-family="Creepster,Impact,fantasy" font-size="47" fill="#202029">Ghost ${number}</text>
    <rect x="125" y="395" width="510" height="510" fill="white"/>
    <image class="cutout-qr" href="/qr/ghost-${number}.svg" x="130" y="400" width="500" height="500"/>
    <text x="380" y="927" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="#45454d">100 points · One capture per hunter</text>
  </svg>`;
}
