export type Education = {
  institution: string;
  /** One rendered line per entry. */
  detail: string[];
  dates: string;
  gpa: string;
};

export const education: Education[] = [
  {
    institution: "University of Virginia, School of Engineering and Applied Science",
    detail: ["BS in Computer Science (AI focal path), Engineering Business minor"],
    dates: "Expected May 2027",
    gpa: "3.5",
  },
  {
    institution: "Rappahannock Community College",
    detail: ["Associate of Arts and Science, Summa Cum Laude"],
    dates: "Aug 2019 to May 2023",
    gpa: "4.0",
  },
];
