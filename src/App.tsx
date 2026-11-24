import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { Header } from "./components/Header";
import { BottomTabBar, AppTab } from "./components/BottomTabBar";
import { RealisticBookView } from "./components/RealisticBookView";
import { DictationStudio } from "./components/DictationStudio";
import { ChapterEditor } from "./components/ChapterEditor";
import { CharactersTimelineModal } from "./components/CharactersTimelineModal";
import { ExportModal } from "./components/ExportModal";
import { NewBookModal } from "./components/NewBookModal";
import { ReorganizationModal } from "./components/ReorganizationModal";
import { AndroidApkModal } from "./components/AndroidApkModal";
import { SettingsModal } from "./components/SettingsModal";
import { PaywallModal } from "./components/PaywallModal";
import { OfflineIndicator } from "./components/OfflineIndicator";
import {
  AppVibrantTheme,
  BillingStatus,
  Book,
  BookChapter,
  BookPaperTheme,
  DictationLog,
  OrganizeResult,
  PaywallReason,
} from "./types";
import {
  DEFAULT_SAMPLE_BOOK,
  ensureUserProfile,
  loadActiveBookId,
  loadBooksFromStorage,
  saveActiveBookId,
  saveBookToCloud,
  saveBooksToStorage,
  subscribeUserBooks,
} from "./utils/storage";
import { fetchBillingStatus } from "./utils/apiClient";

export default function App() {
  const [books, setBooks] = useState<Book[]>(() => loadBooksFromStorage());
  const [activeBookId, setActiveBookId] = useState<string>(() =>
    loadActiveBookId()
  );

  const [activeTab, setActiveTab] = useState<AppTab>("dictation");
  const [vibrantTheme, setVibrantTheme] = useState<AppVibrantTheme>("sunset");
  const [paperTheme, setPaperTheme] = useState<BookPaperTheme>("classic");
  const [fontSize, setFontSize] = useState<number>(18);
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");

  const [showExportModal, setShowExportModal] = useState(false);
  const [showNewBookModal, setShowNewBookModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(
    null
  );

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);

  const [reorganizationData, setReorganizationData] = useState<{
    result: OrganizeResult;
    rawText: string;
  } | null>(null);

  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshBilling = async () => {
    try {
      const status = await fetchBillingStatus();
      setBillingStatus(status);
    } catch (err) {
      console.warn("Billing status notice:", err);
    }
  };

  // Monitor Firebase Authentication & Cloud Firestore Book Sync
  useEffect(() => {
    let unsubscribeBooks: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      await refreshBilling();

      if (unsubscribeBooks) {
        unsubscribeBooks();
        unsubscribeBooks = undefined;
      }

      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);

          // Migrate any locally created personal books up to user's Firestore account
          const localBooks = loadBooksFromStorage().filter((b) => !b.isDemo);
          for (const localBook of localBooks) {
            await saveBookToCloud(firebaseUser.uid, localBook);
          }

          unsubscribeBooks = subscribeUserBooks(
            firebaseUser.uid,
            (cloudBooks) => {
              const merged = [...cloudBooks, DEFAULT_SAMPLE_BOOK];
              setBooks(merged);
              saveBooksToStorage(merged);
              setActiveBookId((prev) =>
                merged.some((b) => b.id === prev)
                  ? prev
                  : cloudBooks[0]?.id || DEFAULT_SAMPLE_BOOK.id
              );
            }
          );
        } catch (err) {
          console.error("Cloud initialization error:", err);
        }
      }
    });

    // Initial billing check for guest sessions
    void refreshBilling();

    return () => {
      unsubAuth();
      if (unsubscribeBooks) unsubscribeBooks();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      await refreshBilling();
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOut(auth);
      await refreshBilling();
    } finally {
      setAuthLoading(false);
    }
  };

  const currentBook = useMemo(() => {
    return (
      books.find((b) => b.id === activeBookId) ||
      books[0] ||
      DEFAULT_SAMPLE_BOOK
    );
  }, [books, activeBookId]);

  const personalBooks = useMemo(
    () => books.filter((b) => !b.isDemo),
    [books]
  );
  const hasPersonalBook = personalBooks.length > 0;
  const isPro = Boolean(billingStatus?.isPro);

  // Persist locally on every change
  useEffect(() => {
    saveBooksToStorage(books);
  }, [books]);

  useEffect(() => {
    if (currentBook) {
      saveActiveBookId(currentBook.id);
      if (
        !selectedChapterId ||
        !currentBook.chapters.some((c) => c.id === selectedChapterId)
      ) {
        if (currentBook.chapters.length > 0) {
          setSelectedChapterId(currentBook.chapters[0].id);
        }
      }
    }
  }, [currentBook?.id]);

  const totalWords = useMemo(() => {
    return currentBook.chapters.reduce((sum, ch) => {
      const words = ch.content.split(/\s+/).filter(Boolean).length;
      return sum + words;
    }, 0);
  }, [currentBook.chapters]);

  const scheduleCloudSync = (bookToSync: Book) => {
    if (!user || bookToSync.isDemo) return;
    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
    }
    cloudSaveTimerRef.current = setTimeout(() => {
      void saveBookToCloud(user.uid, bookToSync);
    }, 600);
  };

  const updateCurrentBook = (updates: Partial<Book>) => {
    if (currentBook.isDemo) return;
    const updatedBook: Book = {
      ...currentBook,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setBooks((prevBooks) =>
      prevBooks.map((b) => (b.id === currentBook.id ? updatedBook : b))
    );
    scheduleCloudSync(updatedBook);
  };

  const handleSelectBook = (bookId: string) => {
    setActiveBookId(bookId);
    const target = books.find((b) => b.id === bookId);
    if (target && target.chapters.length > 0) {
      setSelectedChapterId(target.chapters[0].id);
    }
  };

  const handleRequestNewBook = () => {
    if (!isPro && personalBooks.length >= 1) {
      setPaywallReason("books");
      return;
    }
    setShowNewBookModal(true);
  };

  const handleCreateBook = (newBook: Book) => {
    setBooks((prev) => [newBook, ...prev.filter((b) => b.id !== newBook.id)]);
    setActiveBookId(newBook.id);
    if (newBook.chapters.length > 0) {
      setSelectedChapterId(newBook.chapters[0].id);
    }
    setActiveTab("dictation");
    if (user) {
      void saveBookToCloud(user.uid, newBook);
    }
  };

  const handleUpdateChapter = (
    chapterId: string,
    updates: Partial<BookChapter>
  ) => {
    if (currentBook.isDemo) return;
    const updatedChapters = currentBook.chapters.map((ch) =>
      ch.id === chapterId
        ? { ...ch, ...updates, updatedAt: new Date().toISOString() }
        : ch
    );
    updateCurrentBook({ chapters: updatedChapters });
  };

  const handleAddChapter = () => {
    if (currentBook.isDemo) {
      handleRequestNewBook();
      return;
    }
    if (!isPro && currentBook.chapters.length >= 2) {
      setPaywallReason("chapters");
      return;
    }
    const nextOrder = currentBook.chapters.length + 1;
    const now = new Date().toISOString();
    const newChapter: BookChapter = {
      id: `ch-${Date.now()}`,
      order: nextOrder,
      title: `Capítulo ${nextOrder}: Nuevo Capítulo`,
      summary: "Capítulo creado para continuar la obra.",
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    updateCurrentBook({ chapters: [...currentBook.chapters, newChapter] });
    setSelectedChapterId(newChapter.id);
  };

  const handleDeleteChapter = (chapterId: string) => {
    if (currentBook.isDemo || currentBook.chapters.length <= 1) return;
    const filtered = currentBook.chapters.filter((c) => c.id !== chapterId);
    updateCurrentBook({ chapters: filtered });
    if (selectedChapterId === chapterId && filtered.length > 0) {
      setSelectedChapterId(filtered[0].id);
    }
  };

  const handleReorderChapter = (
    chapterId: string,
    direction: "up" | "down"
  ) => {
    if (currentBook.isDemo) return;
    const list = [...currentBook.chapters];
    const index = list.findIndex((c) => c.id === chapterId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const updated = list.map((c, idx) => ({ ...c, order: idx + 1 }));
    updateCurrentBook({ chapters: updated });
  };

  const handleApplyOrganizeResult = (
    result: OrganizeResult,
    rawText: string
  ) => {
    if (currentBook.isDemo) return;
    let chapters = [...currentBook.chapters];
    let newlyCreatedChapterId: string | undefined;

    result.placements.forEach((placement) => {
      if (placement.action === "create_chapter") {
        if (!isPro && chapters.length >= 2 && chapters.length > 0) {
          // Append cleanly to last chapter instead of bypassing chapter cap on free plan
          const lastIdx = chapters.length - 1;
          const existing = chapters[lastIdx].content.trim();
          chapters[lastIdx] = {
            ...chapters[lastIdx],
            content: existing
              ? `${existing}\n\n${placement.polishedText.trim()}`
              : placement.polishedText.trim(),
            updatedAt: new Date().toISOString(),
          };
          return;
        }
        const nextOrder = placement.newChapterOrder || chapters.length + 1;
        const newChId = `ch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        newlyCreatedChapterId = newChId;
        const now = new Date().toISOString();
        const newChapter: BookChapter = {
          id: newChId,
          order: nextOrder,
          title: placement.newChapterTitle || `Capítulo ${nextOrder}`,
          summary: placement.placementExplanation,
          content: placement.polishedText.trim(),
          createdAt: now,
          updatedAt: now,
        };

        if (
          placement.newChapterOrder &&
          placement.newChapterOrder <= chapters.length
        ) {
          chapters.splice(placement.newChapterOrder - 1, 0, newChapter);
        } else {
          chapters.push(newChapter);
        }
      } else {
        const targetId =
          placement.targetChapterId || selectedChapterId || chapters[0]?.id;
        const targetIndex = chapters.findIndex((c) => c.id === targetId);

        if (targetIndex !== -1) {
          const target = chapters[targetIndex];
          const existingContent = target.content.trim();
          const newContent =
            placement.action === "insert"
              ? existingContent
                ? `${placement.polishedText.trim()}\n\n${existingContent}`
                : placement.polishedText.trim()
              : existingContent
              ? `${existingContent}\n\n${placement.polishedText.trim()}`
              : placement.polishedText.trim();

          chapters[targetIndex] = {
            ...target,
            content: newContent,
            updatedAt: new Date().toISOString(),
          };
        } else if (chapters.length > 0) {
          chapters[0] = {
            ...chapters[0],
            content:
              (chapters[0].content ? chapters[0].content + "\n\n" : "") +
              placement.polishedText.trim(),
            updatedAt: new Date().toISOString(),
          };
        }
      }
    });

    chapters = chapters.map((c, idx) => ({ ...c, order: idx + 1 }));

    const characters = [...currentBook.characters];
    if (result.newCharacters && result.newCharacters.length > 0) {
      result.newCharacters.forEach((nc) => {
        if (
          !isPro &&
          characters.length >= 3
        ) {
          return;
        }
        if (
          nc.name &&
          !characters.some(
            (c) => c.name.toLowerCase() === nc.name.toLowerCase()
          )
        ) {
          characters.push({
            id: `char-${Date.now()}-${Math.random()}`,
            name: nc.name,
            role: nc.role,
            description: nc.description,
          });
        }
      });
    }

    const timeline = [...currentBook.timeline];
    if (result.newTimelineEvents && result.newTimelineEvents.length > 0) {
      result.newTimelineEvents.forEach((ne) => {
        timeline.push({
          id: `tl-${Date.now()}-${Math.random()}`,
          timeContext: ne.timeContext,
          event: ne.event,
        });
      });
    }

    const logItem: DictationLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      rawText,
      mode: "Reorganización Inteligente",
      explanation: result.analysisSummary,
      placementsCount: result.placements.length,
    };

    updateCurrentBook({
      chapters,
      characters,
      timeline,
      title: result.suggestedTitle || currentBook.title,
      synopsis: result.suggestedSynopsis || currentBook.synopsis,
      dictationHistory: [logItem, ...(currentBook.dictationHistory || [])],
    });

    if (newlyCreatedChapterId) {
      setSelectedChapterId(newlyCreatedChapterId);
    }

    setReorganizationData({ result, rawText });
  };

  const handleGoToDictationForChapter = (chapterId: string) => {
    setSelectedChapterId(chapterId);
    setActiveTab("dictation");
  };

  return (
    <div
      className={`min-h-screen text-stone-100 flex flex-col antialiased selection:bg-rose-400 selection:text-stone-950 theme-${vibrantTheme}`}
      style={{ background: "var(--bg-gradient)" }}
    >
      {/* Compact 1-Row Top Bar */}
      <Header
        currentBook={currentBook}
        allBooks={books}
        onSelectBook={handleSelectBook}
        onNewBook={handleRequestNewBook}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenPaywall={() => setPaywallReason("general")}
        billingStatus={billingStatus}
        totalWords={totalWords}
      />

      {/* Main Content Area with Bottom Bar Clearance */}
      <main className="flex-1 pb-24">
        {activeTab === "dictation" && (
          <DictationStudio
            currentBook={currentBook}
            hasPersonalBook={hasPersonalBook}
            onOpenNewBook={handleRequestNewBook}
            onApplyOrganizeResult={handleApplyOrganizeResult}
            onSelectChapter={(id) => {
              setSelectedChapterId(id);
              setActiveTab("reader");
            }}
            selectedChapterId={selectedChapterId}
            setSelectedChapterId={setSelectedChapterId}
            billingStatus={billingStatus}
            onBillingUpdated={setBillingStatus}
            onTriggerPaywall={(reason) => setPaywallReason(reason)}
          />
        )}

        {activeTab === "editor" && (
          <ChapterEditor
            currentBook={currentBook}
            onUpdateChapter={handleUpdateChapter}
            onAddChapter={handleAddChapter}
            onDeleteChapter={handleDeleteChapter}
            onReorderChapter={handleReorderChapter}
            selectedChapterId={selectedChapterId}
            setSelectedChapterId={setSelectedChapterId}
            onGoToDictation={handleGoToDictationForChapter}
            onOpenNewBook={handleRequestNewBook}
            billingStatus={billingStatus}
            onBillingUpdated={setBillingStatus}
            onTriggerPaywall={(reason) => setPaywallReason(reason)}
          />
        )}

        {activeTab === "reader" && (
          <RealisticBookView
            currentBook={currentBook}
            paperTheme={paperTheme}
            fontSize={fontSize}
            onGoToDictationForChapter={handleGoToDictationForChapter}
            selectedChapterId={selectedChapterId}
            setSelectedChapterId={setSelectedChapterId}
            billingStatus={billingStatus}
            onTriggerPaywall={(reason) => setPaywallReason(reason)}
          />
        )}

        {activeTab === "characters" && (
          <CharactersTimelineModal
            currentBook={currentBook}
            onUpdateBook={updateCurrentBook}
            onOpenNewBook={handleRequestNewBook}
            billingStatus={billingStatus}
            onTriggerPaywall={(reason) => setPaywallReason(reason)}
          />
        )}
      </main>

      {/* Fixed Native Bottom Tab Bar */}
      <BottomTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Reorganization Summary Modal */}
      {reorganizationData && (
        <ReorganizationModal
          result={reorganizationData.result}
          rawText={reorganizationData.rawText}
          onClose={() => setReorganizationData(null)}
          onViewChapter={(chId) => {
            if (chId) setSelectedChapterId(chId);
            setActiveTab("reader");
            setReorganizationData(null);
          }}
        />
      )}

      {/* Export Modal (.epub, .docx, PDF, .txt) */}
      {showExportModal && (
        <ExportModal
          currentBook={currentBook}
          onClose={() => setShowExportModal(false)}
          billingStatus={billingStatus}
          onTriggerPaywall={(reason) => {
            setShowExportModal(false);
            setPaywallReason(reason);
          }}
        />
      )}

      {/* New Book Modal */}
      {showNewBookModal && (
        <NewBookModal
          onClose={() => setShowNewBookModal(false)}
          onCreateBook={handleCreateBook}
        />
      )}

      {/* Settings Modal (Themes, Account, Subscription Portal, APK, FAQ) */}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          user={user}
          authLoading={authLoading}
          onGoogleSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          billingStatus={billingStatus}
          onRefreshBilling={refreshBilling}
          onOpenPaywall={(reason) => setPaywallReason(reason || "general")}
          vibrantTheme={vibrantTheme}
          setVibrantTheme={setVibrantTheme}
          paperTheme={paperTheme}
          setPaperTheme={setPaperTheme}
          fontSize={fontSize}
          setFontSize={setFontSize}
          onOpenAndroidApk={() => setShowAndroidModal(true)}
        />
      )}

      {/* SaaS Paywall Modal */}
      {paywallReason && (
        <PaywallModal
          reason={paywallReason}
          onClose={() => setPaywallReason(null)}
          user={user}
          onGoogleSignIn={handleGoogleSignIn}
          billingStatus={billingStatus}
          onRefreshBilling={refreshBilling}
        />
      )}

      {/* Android APK Download Modal */}
      {showAndroidModal && (
        <AndroidApkModal onClose={() => setShowAndroidModal(false)} />
      )}

      <OfflineIndicator />
    </div>
  );
}
