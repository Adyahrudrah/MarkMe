import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { BookmarkContext, BookmarkTree } from "../App";
import type { ChromeBookmarkNode } from "../types/types";
import { BookmarkContextMenu } from "./ContextMenu";

export const BookmarkNode = ({
	bookmark,
	isSearchResult = false,
	searchQuery = "", // Add this prop
}: {
	bookmark: ChromeBookmarkNode;
	isSearchResult?: boolean;
	searchQuery?: string; // Add to prop types
}) => {
	const { refreshBookmarks } = useContext(BookmarkContext);
	const [isToggled, setIsToggled] = useState(isSearchResult);
	const [faviconError, setFaviconError] = useState(false);
	const [currentFaviconIndex, setCurrentFaviconIndex] = useState(0);
	const [isVisible, setIsVisible] = useState(false);
	const [showContextMenu, setShowContextMenu] = useState(false);
	const [contextMenuPosition, setContextMenuPosition] = useState({
		x: 0,
		y: 0,
	});

	const faviconRef = useRef<HTMLImageElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const nodeRef = useRef<HTMLDivElement>(null);

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();

		if (bookmark) {
			// Get viewport dimensions
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Calculate adjusted position
			let x = e.clientX;
			let y = e.clientY;

			// Context menu dimensions (estimate or calculate if known)
			const menuWidth = 500; // Adjust based on your actual menu width
			const menuHeight = 400; // Adjust based on your actual menu height

			console.log(x, y, menuHeight);

			// Adjust if too close to right edge
			if (x + menuWidth > viewportWidth) {
				x = viewportWidth - menuWidth - 5; // 5px padding from edge
			}

			// Adjust if too close to bottom edge
			if (y + menuHeight > viewportHeight) {
				y = viewportHeight - menuHeight - 5; // 5px padding from edge
			}

			setContextMenuPosition({ x, y });
			setShowContextMenu(true);
		}
	};

	const closeContextMenu = useCallback(() => {
		setShowContextMenu(false);
	}, []);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
				closeContextMenu();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [closeContextMenu]);

	const faviconSources = useMemo(() => {
		if (!bookmark.url) return [];
		try {
			const url = new URL(bookmark.url);
			const hostname = url.hostname;
			return [
				`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
				`${url.protocol}//${hostname}/favicon.ico`,
				`${url.protocol}//${hostname}/favicon.png`,
				`${url.protocol}//www.${hostname}/favicon.ico`,
			];
		} catch {
			return [];
		}
	}, [bookmark.url]);

	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => entry.isIntersecting && setIsVisible(true),
			{ root: null, rootMargin: "100px", threshold: 0.1 },
		);
		if (containerRef.current) observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!isSearchResult) {
			chrome.storage.local.get(["bookmarkToggles"], (result) => {
				const toggles = result.bookmarkToggles || {};
				if (toggles[bookmark.id] !== undefined) {
					setIsToggled(toggles[bookmark.id]);
				}
			});
		}
	}, [bookmark.id, isSearchResult]);

	const handleFaviconError = () => {
		if (currentFaviconIndex < faviconSources.length - 1) {
			setCurrentFaviconIndex(currentFaviconIndex + 1);
		} else {
			setFaviconError(true);
		}
	};

	const toggleBookmark = () => {
		const newState = !isToggled;
		setIsToggled(newState);
		if (!isSearchResult) {
			chrome.storage.local.get(["bookmarkToggles"], (result) => {
				const toggles = result.bookmarkToggles || {};
				toggles[bookmark.id] = newState;
				chrome.storage.local.set({ bookmarkToggles: toggles });
			});
		}
	};

	const handleDelete = () => {
		if (window.confirm(`Delete "${bookmark.title}"?`)) {
			chrome.bookmarks.remove(bookmark.id, refreshBookmarks);
		}
	};

	const handleDeleteFolder = (bookmark: ChromeBookmarkNode) => {
		chrome.bookmarks.remove(bookmark.id, refreshBookmarks);
	};

	return (
		<section className="bookmark-folder" ref={containerRef}>
			{bookmark.children && (
				<div className="flex justify-between">
					<button
						type="button"
						onClick={toggleBookmark}
						className="bookmark-title"
						onContextMenu={handleContextMenu}
					>
						{bookmark.title.replace("_", " ")}
						{bookmark.children.length === 0 && (
							<button
								type="button"
								className="fa-solid fa-trash ml-6"
								onClick={() => handleDeleteFolder(bookmark)}
							></button>
						)}
					</button>
				</div>
			)}

			{(isSearchResult || isToggled) && bookmark.children && (
				<BookmarkTree
					bookmarkTree={bookmark.children}
					searchQuery={searchQuery}
				/>
			)}

			{!bookmark.children && (
				<div ref={nodeRef} className="bookmark-url">
					<p className="bookmarkContent" onContextMenu={handleContextMenu}>
						{isVisible &&
							bookmark.url &&
							!faviconError &&
							faviconSources.length > 0 && (
								<img
									ref={faviconRef}
									src={faviconSources[currentFaviconIndex]}
									alt="Favicon"
									className="bookmark-favicon"
									onError={handleFaviconError}
									onLoad={() => setFaviconError(false)}
								/>
							)}
						{faviconError && <i className="fas fa-bookmark"></i>}
						<div className="flex flex-col">
							<a href={bookmark.url} target="_blank" rel="noopener noreferrer">
								{bookmark.title.split(/:|-|\|/).map((t, i) =>
									i === 0 ? (
										<i key={t}>{t}</i>
									) : (
										<em key={t} className="title-desc">
											{t}
										</em>
									),
								)}
							</a>
							<span className="text-white/30 text-xs">
								{bookmark.url?.split("/").slice(3).join(" ")}
							</span>
						</div>

						<button
							type="button"
							onClick={handleDelete}
							className="delete-bookmark"
							title="Delete"
						>
							<i className="fa-solid fa-trash"></i>
						</button>
					</p>

					{showContextMenu && (
						<div
							className="context-menu-container"
							style={{
								position: "fixed",
								left: contextMenuPosition.x,
								top: contextMenuPosition.y,
								zIndex: 1000,
							}}
						>
							<BookmarkContextMenu
								bookmarkId={bookmark.id}
								onClose={closeContextMenu}
								currentParentId={bookmark.parentId || "1"}
								searchQuery={searchQuery}
							/>
						</div>
					)}
				</div>
			)}
		</section>
	);
};
