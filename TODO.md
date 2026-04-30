When the view drawer slides up, we populate the pattern data in a consistent manner below the pattern to represent the "print view"
Update print view with forced padding. Figure this out once the attribution card has been designed.
Update the print view to include any additional information and instructions as separate pages
Update the image download to have the attribution card, plus all instructions

Update admin panel for patterns to have a "show deleted patterns" section.
The database doesn't actually use any permissions... maybe set that up lol

---

Previously we've built two components on the Pattern View Drawer that would export the pattern in a variety of ways. The first is in an image format, and the second is for generating a PDF to print in a large format, or a "tiled paper" mode that prints a large SVG image across multiple 8.5in x 11in sheets of paper. We've optimized our SVG upload and database info, and now we're ready to create the next iteration of these export features.

Let's start with the image export, called "Download Pattern". This has a dropdown option for selecting the type of image export:

type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
type DpiOption = 72 | 96 | 150 | 300 | 600;

const FORMAT_OPTIONS: { value: ExportFormat; label: string; mime: string }[] = [
{ value: 'png', label: 'PNG  — best for Cricut / vinyl cutters', mime: 'image/png' },
{ value: 'jpg', label: 'JPG  — smaller file, no transparency', mime: 'image/jpeg' },
{ value: 'webp', label: 'WebP — modern web format', mime: 'image/webp' },
{ value: 'svg', label: 'SVG  — vector', mime: 'image/svg+xml' },
];

The pattern export will have a "Target Pattern Size" option that has a MUI TextField component for the desired Width and Height. This should scale the pattern in the same ratio that the pattern exists in, while preserving the existing line width. This part is important because the line thickness should not change. Here is the pattern DTO where the original width and height of the pattern is stored:

type TypePatternResponse = {
collectionId: string;
collectionName: string;
id: string;
name: string;
description: string;
instructions: string;
difficulty: string;
authors: string[];
author_manual: string[];
uploaded_by: string;
design_date: Date | Dayjs | null;
tags: string[];
pattern_file: string;
pattern_file_external: string;
pattern_file_external_link: string;
opengraph_image: string;
pieces: number;
design_width: number;
design_height: number;
line_width: number;
design_width_unit: string;
design_height_unit: string;
line_width_unit: string;
created: string;
updated: string;
pattern_key_reference_list: TypePatternKeyReferenceObject[];
expand?: {
authors: TypeAuthData[];
};
};

Users will be able to choose inches, centimeters, millimeters, or pixels for their size export. They will also be able to choose the DPI, but the DPI option should disappear when pixels are selected. The pattern will take the database values of design_width + design_width_unit, and design_height + design_height_unit, and scale that up to the requested size. The line width will be preserved by calculating the ratio of the new size to the original size, and applying that ratio to the original line width.

Requirements:
- png export should have a transparent background
- jpg export with an option for white or black background
- webp export should have a transparent background
- svg export has two options. The first option should be the scaled up SVG according to the target width and height. The second option should be the original SVG file

Once that is generated, we want to create a legend card that outlines some information about the pattern. It should have: the name of the pattern, the author, the exported file size (Project Size: 36in x 24in), the number of pieces, the line width (should be the same as the original line width), the Design Date (MM-DD-YYYY), and a section that generates the image pattern keys. This is an array of objects containing {fullPath: 'full-image-url-here', name: 'key name here'}. This denotes what type of line is used for what. Straight lines, dotted lines, dashed lines, or circles. This whole legend can be a separate function because we'll need to have this for the print view as well. Since the number of pattern keys is dynamic, we will need to find a way to make the height dynamic. 

Once the legend is generated, it will need to be added to the bottom right of the image export, with some space around so it doesnt touch the pattern lines, or the end of the image.

Once that legend is added, we now need to find the pattern instructions. This is a large text entry of Markdown code. This will need to be inserted into the image after the legend has been created. The instructions should be in 16px font, regardless of what the image size is, and should only take up a maximum of 700px across. There should be an option in the UI to enable or disable the instructions export.

Make sure to comment the main sections with explanations of how they work.

---

I will also need a TSX version of this using MUI components that I will be adding to the Pattern View drawer. This way the user will get a glimpse of what the exported file will look like.

---

Phase 2 i've been thinking about: it would be cool if users could upload their completed patterns and then we could feature them on the pattern view with their name linked to it so people can click to their profiles if they want. Thoughts?

Then i'm thinking Phase 3 will be in a few months after we have a solid foundation of patterns and users. We will build a full online e-learning platform. So start looking up good microphones and cameras and we'll get you recording tutorials. Dee can start writing up quizzes for people and then i'll work on a trophy system (brings engagement). People can show off their completed course work on their profile page (gamification)
We can start selling premium courses to start funding the site

Phase 4 will start in 2027. This will be setting up a store directly on the site to compete with Etsy so that people can sell their patterns through Pattern Archive. We can easily undercut etsy's fees

