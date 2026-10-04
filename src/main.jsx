import { createRoot } from "react-dom/client";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Menu,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import manifest from "../content/manifest.json";
import { initArticleInteractions } from "./article-interactions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import "./styles.css";
import "./quant-motion.css";

const pages = manifest.days.flatMap((day) =>
  day.pages.map((page) => ({ ...page, date: day.date, dateLabel: day.label })),
);
const pageCache = new Map();
function route() {
  const [id, section] = location.hash.slice(1).split("/");
  return {
    id: pages.some((page) => page.id === id) ? id : pages[0].id,
    section,
  };
}
function initialTheme() {
  try {
    const stored = localStorage.getItem("new-tech-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* Storage is unavailable in sandboxed bookmark previews. */
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const ArticleBody = memo(function ArticleBody({ html, onReady }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    // These HTML fragments are repository-owned research documents, never user input.
    ref.current.innerHTML = html;
    const dispose = initArticleInteractions(ref.current);
    ref.current.querySelectorAll("img").forEach((image) => {
      image.loading = "lazy";
      image.decoding = "async";
    });
    const sections = [
      ...ref.current.querySelectorAll("h2[id], section[aria-labelledby] h2"),
    ]
      .filter((heading) => heading.id)
      .map((heading) => ({ id: heading.id, title: heading.textContent }));
    onReady({
      sections,
      minutes: Math.max(
        1,
        Math.round(ref.current.textContent.replace(/\s+/g, " ").length / 430),
      ),
    });
    return dispose;
  }, [html, onReady]);
  return <div ref={ref} />;
});

function App() {
  const [current, setCurrent] = useState(route);
  const [theme, setTheme] = useState(initialTheme);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [article, setArticle] = useState({ id: null, html: "", error: null });
  const [retry, setRetry] = useState(0);
  const [details, setDetails] = useState({ sections: [], minutes: null });
  const [activeSection, setActiveSection] = useState("");
  const mainRef = useRef(null);
  const page = pages.find((item) => item.id === current.id);
  const pageIndex = pages.indexOf(page);
  const loading = article.id !== page.id;
  const onReady = useCallback((value) => setDetails(value), []);

  useEffect(() => {
    const update = () => {
      setCurrent(route());
      setMenuOpen(false);
    };
    const keyboard = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMenuOpen(false);
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content =
      theme === "dark" ? "#171717" : "#ffffff";
    try {
      localStorage.setItem("new-tech-theme", theme);
    } catch {
      /* Sandboxed previews can deny storage. */
    }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    setDetails({ sections: [], minutes: null });
    setActiveSection("");
    document.title = `${page.title} · NEW_TECH`;
    async function load() {
      try {
        let html =
          window.__NEW_TECH_CONTENT__?.pages?.[page.file] ??
          pageCache.get(page.file);
        if (html === undefined) {
          const response = await fetch(page.file, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          html = await response.text();
          pageCache.set(page.file, html);
        }
        if (!controller.signal.aborted)
          setArticle({ id: page.id, html, error: null });
      } catch (error) {
        if (!controller.signal.aborted)
          setArticle({ id: page.id, html: "", error: error.message });
      }
    }
    load();
    return () => controller.abort();
  }, [page, retry]);

  useEffect(() => {
    if (loading || article.error) return;
    const frame = requestAnimationFrame(() => {
      const target =
        current.section && document.getElementById(current.section);
      if (target)
        target.scrollIntoView({ block: "start", behavior: "instant" });
      else window.scrollTo({ top: 0, behavior: "instant" });
      if (!menuOpen && !searchOpen)
        mainRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [current, loading, article.error]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    details.sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [details]);

  const navigate = (id) => {
    location.hash = id;
    setSearchOpen(false);
    setMenuOpen(false);
  };
  function navigation() {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <a
          href={`#${pages[0].id}`}
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2.5 px-5 py-6 text-sm font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-foreground font-mono text-xs text-background">
            N/
          </span>
          NEW_TECH{" "}
          <Badge variant="outline" className="ml-auto text-[10px] font-normal">
            Notes
          </Badge>
        </a>
        <div className="px-4 pb-6">
          <Button
            variant="outline"
            onClick={() => {
              setMenuOpen(false);
              setSearchOpen(true);
            }}
            className="w-full justify-start bg-background text-muted-foreground shadow-none"
          >
            <Search className="size-4" />
            노트 검색
            <span className="ml-auto rounded border px-1.5 font-mono text-[10px]">
              ⌘ / Ctrl K
            </span>
          </Button>
        </div>
        <nav
          aria-label="날짜별 페이지"
          className="min-h-0 flex-1 space-y-7 overflow-y-auto px-3 pb-8"
        >
          {manifest.days.map((day) => (
            <section key={day.date}>
              <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-medium text-muted-foreground">
                <span>{day.date.replaceAll("-", ".")}</span>
                <span className="h-px flex-1 bg-border" />
                <span>{day.pages.length}</span>
              </div>
              {day.pages.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setMenuOpen(false)}
                  aria-current={page.id === item.id ? "page" : undefined}
                  className={`group my-1 flex items-start gap-2.5 rounded-md px-2.5 py-2.5 text-[13px] transition-colors hover:bg-accent ${page.id === item.id ? "bg-accent font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  <FileText className="mt-0.5 size-4 shrink-0 opacity-60" />
                  <span className="min-w-0">
                    <span className="block leading-5">{item.title}</span>
                    <span className="mt-1 block text-[10px] font-normal leading-4 text-muted-foreground">
                      {item.subtitle}
                    </span>
                  </span>
                </a>
              ))}
            </section>
          ))}
        </nav>
        <div className="border-t px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-medium">
            <BookOpen className="size-3.5 text-muted-foreground" />
            Inference field notes
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {pages.length}개의 노트 · 출처와 함께 읽는 기술
          </p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <a
        href="#article-root"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
        className="fixed -top-20 left-4 z-[100] rounded-md bg-primary px-4 py-2 text-primary-foreground focus:top-4"
      >
        본문으로 이동
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-[280px] border-r bg-muted/30 md:block">
        {navigation()}
      </aside>
      <div className="min-w-0 md:ml-[280px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background px-4 md:px-8">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="목차 열기"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(320px,90vw)] gap-0 p-0"
              onCloseAutoFocus={(event) => {
                if (searchOpen) event.preventDefault();
              }}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>기술 노트 목차</SheetTitle>
                <SheetDescription>
                  날짜별로 정리한 기술 노트를 선택합니다.
                </SheetDescription>
              </SheetHeader>
              {navigation()}
            </SheetContent>
          </Sheet>
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap text-xs">
              <BreadcrumbItem className="hidden shrink-0 sm:block">
                {page.date.replaceAll("-", ".")}
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="truncate">
                  {page.title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground lg:block">
            {!loading && details.minutes ? `${details.minutes} MIN READ` : ""}
          </span>
          <Separator orientation="vertical" className="mx-1 !h-4" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="노트 검색"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>노트 검색 · Ctrl/⌘ K</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  theme === "dark" ? "밝은 모드로 전환" : "어두운 모드로 전환"
                }
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>색상 모드 전환</TooltipContent>
          </Tooltip>
        </header>
        <div className="mx-auto flex max-w-[1400px] items-start">
          <main
            ref={mainRef}
            id="article-root"
            tabIndex={-1}
            aria-busy={loading}
            className="min-w-0 flex-1 outline-none"
          >
            {loading ? (
              <div role="status" className="space-y-6 px-5 py-14 md:px-12">
                <span className="sr-only">노트를 불러오는 중입니다.</span>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-12 w-4/5" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="mt-16 h-64 w-full" />
              </div>
            ) : article.error ? (
              <div role="alert" className="space-y-4 px-8 py-20">
                <h1 className="text-2xl font-semibold">
                  노트를 불러오지 못했습니다.
                </h1>
                <p className="text-muted-foreground">
                  연결 상태를 확인하고 다시 시도해 주세요. ({article.error})
                </p>
                <Button
                  onClick={() => {
                    setArticle({ id: null, html: "", error: null });
                    setRetry((value) => value + 1);
                  }}
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              <>
                <ArticleBody
                  key={page.id}
                  html={article.html}
                  onReady={onReady}
                />
                <nav
                  aria-label="이전 및 다음 페이지"
                  className="mx-5 mb-12 grid gap-3 border-t pt-6 sm:grid-cols-2 md:mx-12"
                >
                  {[-1, 1].map((direction) => {
                    const sibling = pages[pageIndex + direction];
                    return sibling ? (
                      <Button
                        key={direction}
                        asChild
                        variant="outline"
                        className="h-auto min-h-24 items-start justify-start whitespace-normal p-4 text-left shadow-none"
                      >
                        <a href={`#${sibling.id}`}>
                          <span className="flex flex-col gap-2">
                            <span className="flex items-center gap-2 text-[11px] font-normal text-muted-foreground">
                              {direction < 0 ? (
                                <ArrowLeft className="size-3" />
                              ) : (
                                <ArrowRight className="size-3" />
                              )}
                              {direction < 0 ? "이전 노트" : "다음 노트"}
                            </span>
                            <span className="text-sm">{sibling.title}</span>
                          </span>
                        </a>
                      </Button>
                    ) : (
                      <div key={direction} className="hidden sm:block" />
                    );
                  })}
                </nav>
              </>
            )}
          </main>
          <aside
            aria-label="이 페이지의 목차"
            className="sticky top-16 hidden max-h-[calc(100vh-4rem)] w-56 shrink-0 overflow-auto px-5 py-14 min-[1440px]:block"
          >
            <p className="mb-4 text-xs font-medium">이 페이지에서</p>
            <nav className="space-y-1 border-l">
              {details.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${page.id}/${section.id}`}
                  aria-current={
                    activeSection === section.id ? "location" : undefined
                  }
                  className={`-ml-px block border-l py-2 pl-4 text-xs leading-5 ${activeSection === section.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {section.title}
                </a>
              ))}
            </nav>
            <p className="mt-8 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Check className="size-3" />
              수치는 조건·출처와 함께
            </p>
          </aside>
        </div>
        <footer className="mx-5 flex flex-wrap justify-between gap-2 border-t py-6 text-[10px] text-muted-foreground md:mx-12">
          <span className="font-mono tracking-wider">
            NEW_TECH / INFERENCE NOTES
          </span>
          <span>수치는 조건과 출처를 함께 읽습니다.</span>
        </footer>
      </div>
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="노트 검색"
        description="제목, 기술 이름 또는 날짜로 노트를 찾습니다."
      >
        <CommandInput
          aria-label="노트 검색"
          placeholder="제목, 기술 이름, 날짜 검색…"
        />
        <CommandList>
          <CommandEmpty>일치하는 노트가 없습니다.</CommandEmpty>
          {manifest.days.map((day) => (
            <CommandGroup key={day.date} heading={day.label}>
              {day.pages.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle} ${day.date}`}
                  onSelect={() => navigate(item.id)}
                >
                  <FileText />
                  <span className="min-w-0">
                    <span className="block">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  </span>
                  <ChevronRight className="ml-auto" />
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </TooltipProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
