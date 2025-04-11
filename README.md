# markMe - Chrome Bookmark Manager

A powerful Chrome extension that replaces your new tab page with an enhanced bookmark manager.

## Features

- View all bookmarks in a clean, organized interface
- Delete unwanted bookmarks
- Reorganize bookmarks by moving them between folders
- Fast search through your bookmarks
- Built with React 19 and TypeScript for reliability

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Build the extension: `npm run build`
4. In Chrome, go to `chrome://extensions`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist` folder

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Technical Details

- Uses Chrome's Bookmarks API for all operations
- Built with:
  - React 19
  - TypeScript
  - Vite
  - TailwindCSS
- Requires permissions:
  - `bookmarks` - For accessing and managing bookmarks
  - `tabs` - For new tab override
  - `storage` - For extension settings

## Contributing

Pull requests are welcome! Please ensure:
- All tests pass
- Code follows existing style
- New features include documentation
