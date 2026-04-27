import {
	createContext,
	type JSX,
	useCallback,
	useEffect,
	useState,
} from "react";
import type { ChromeBookmarkNode } from "./types/types";
import "./index.css";
import { BookmarkNode } from "./componenets/BookMarkNode";

// Create Bookmark Context
export const BookmarkContext = createContext<{
	bookmarks: ChromeBookmarkNode[];
	refreshBookmarks: () => void;
}>({
	bookmarks: [],
	refreshBookmarks: () => {},
});

function App() {
	const [bookmarks, setBookmarks] = useState<ChromeBookmarkNode[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [isCreatingFolder, setIsCreatingFolder] = useState(false);
	const [newFolderName, setNewFolderName] = useState("");
	const [newFolderParentId, setNewFolderParentId] = useState("1");
	const [availableFolders, setAvailableFolders] = useState<
		ChromeBookmarkNode[]
	>([]);

	const fetchAllFolders = useCallback(() => {
		chrome.bookmarks.getTree((tree) => {
			const flattenFolders = (
				nodes: ChromeBookmarkNode[],
			): ChromeBookmarkNode[] => {
				return nodes.reduce<ChromeBookmarkNode[]>((acc, node) => {
					if (node.children) {
						return [...acc, node, ...flattenFolders(node.children)];
					}
					return acc;
				}, []);
			};
			setAvailableFolders(flattenFolders(tree[0].children || []));
		});
	}, []);

	const refreshBookmarks = useCallback(() => {
		chrome.bookmarks.getTree((tree) => {
			setBookmarks(tree[0].children || []);
		});
	}, []);

	useEffect(() => {
		refreshBookmarks();
	}, [refreshBookmarks]);

	const openFolderCreation = useCallback(() => {
		fetchAllFolders();
		setIsCreatingFolder(true);
	}, [fetchAllFolders]);

	const createFolder = useCallback(() => {
		if (!newFolderName.trim()) return;

		chrome.bookmarks.create(
			{
				parentId: newFolderParentId,
				title: newFolderName,
			},
			() => {
				refreshBookmarks();
				setIsCreatingFolder(false);
				setNewFolderName("");
			},
		);
	}, [newFolderName, newFolderParentId, refreshBookmarks]);

	return (
		<BookmarkContext.Provider value={{ bookmarks, refreshBookmarks }}>
			<div className="bookmarks-container">
				<div className="search-container">
					<button
						type="button"
						className="create-bookmark-folder"
						onClick={openFolderCreation}
					>
						<i className="fa-solid fa-folder"></i>
					</button>
					<div className="searchWrapper">
						<input
							type="text"
							placeholder="Search bookmarks..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="search-input"
						/>
						<i className="fa-solid fa-search"></i>
					</div>
				</div>
				<BookmarkTree bookmarkTree={bookmarks} searchQuery={searchQuery} />
			</div>
			{isCreatingFolder && (
				<div className="modal-overlay">
					<div
						className="modal-content bg-zinc-800 text-zinc-300"
						style={{ width: "400px" }}
					>
						<h3>Create New Folder</h3>
						<div className="form-group bg-zinc-800">
							<input
								type="text"
								placeholder="Enter folder name"
								value={newFolderName}
								onChange={(e) => setNewFolderName(e.target.value)}
							/>
						</div>

						<div className="form-group ">
							<div className="folder-select-container">
								<ul className="folder-list">
									{availableFolders.map((folder) => (
										<li key={folder.id}>
											<button
												type="button"
												className={`folder-item w-full text-left ${
													newFolderParentId === folder.id
														? "bg-zinc-300 text-zinc-900"
														: "bg-zinc-800 text-zinc-300"
												}`}
												onClick={() => setNewFolderParentId(folder.id)}
											>
												<i className="fas fa-folder"></i>
												<span className="folder-title">{folder.title}</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						</div>

						<div className="modal-actions">
							<button type="button" onClick={() => setIsCreatingFolder(false)}>
								Cancel
							</button>
							<button
								type="button"
								onClick={createFolder}
								disabled={!newFolderName.trim()}
								className="primary"
							>
								Create Folder
							</button>
						</div>
					</div>
				</div>
			)}
		</BookmarkContext.Provider>
	);
}

export const BookmarkTree = ({
	bookmarkTree,
	searchQuery = "",
}: {
	bookmarkTree: ChromeBookmarkNode[];
	searchQuery?: string;
}) => {
	const shouldShow = (bookmark: ChromeBookmarkNode): boolean => {
		if (!searchQuery) return true;

		const query = searchQuery.toLowerCase();
		const titleMatch = bookmark.title.toLowerCase().includes(query);
		const urlMatch = bookmark.url?.toLowerCase().includes(query) || false;

		if (bookmark.children) {
			return titleMatch || bookmark.children.some((child) => shouldShow(child));
		}

		return titleMatch || urlMatch;
	};

	const renderBookmarkNode = (
		bookmark: ChromeBookmarkNode,
	): JSX.Element | null => {
		if (searchQuery && !shouldShow(bookmark)) return null;

		return (
			<BookmarkNode
				key={bookmark.id}
				bookmark={bookmark}
				isSearchResult={searchQuery.length > 0}
				searchQuery={searchQuery} // Pass it down
			/>
		);
	};

	const visibleBookmarks = bookmarkTree
		.map(renderBookmarkNode)
		.filter((node) => node !== null);

	if (searchQuery && visibleBookmarks.length === 0) {
		return <div className="no-results">No bookmarks found</div>;
	}

	return <div className="bookmarks-list">{visibleBookmarks}</div>;
};

export default App;
