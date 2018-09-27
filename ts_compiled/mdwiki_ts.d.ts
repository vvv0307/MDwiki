/// <reference path="../typings/index.d.ts" />
declare module MDwiki.Links {
    class LinkRewriter {
        private domElement;
        constructor(domElement: any);
        static processPageLinks(domElement?: any, baseUrl?: any): void;
    }
}
declare module MDwiki.Legacy {
    class PageSkeleton {
        config: any;
        domElement: JQuery;
        constructor(config: any, domElement: Node);
        createBasicSkeleton(): void;
        private setPageTitle();
        private wrapParagraphText();
        private removeBreaks();
        private getFloatClass(par);
        private groupImages();
        private linkImagesToSelf();
        private addInpageAnchors();
    }
}
declare module MDwiki.Utils {
    class Url {
        static isRelativeUrl(url: string): boolean;
        static isRelativePath(path: any): boolean;
        static isGimmickLink(domAnchor: any): boolean;
        static hasMarkdownFileExtension(str: any): boolean;
    }
    class Util {
        static wait(miliseconds: Number): JQueryDeferred<{}>;
        static prepareLink(link: any, options: any): string;
        static repeatUntil(interval: any, predicate: any, maxRepeats: any): JQueryDeferred<{}>;
        static countDownLatch(capacity: any, min: any): any;
        static getInpageAnchorText(text: any): any;
        static getInpageAnchorHref(text: any, href?: any): string;
    }
}
declare module MDwiki.Templating {
    class Template {
        model: any;
        private templateFunction;
        private renderedTemplate;
        constructor(path?: string);
        render(): any;
        private assertTemplateIsReady();
        replace(node: any): JQuery;
        appendTo(node: any): JQuery;
        insertAfter(node: any): JQuery;
        insertBefore(node: any): JQuery;
    }
}
import util = MDwiki.Utils.Util;
import Template = MDwiki.Templating.Template;
declare module MDwiki.Legacy {
    class Bootstrap {
        private events;
        private stages;
        private config;
        constructor(stages: StageChain, config: any);
        bootstrapify(): void;
        private bind(ev, func);
        private trigger(ev);
        private parseHeader();
        private buildTopNav();
        private set_offset_to_navbar();
        private check_offset_to_navbar();
        private buildMenu();
        private isVisibleInViewport(e);
        private createPageContentMenu();
        private createPageSkeleton();
        private changeHeading();
        private highlightActiveLink();
        private replaceImageParagraphs();
        private adjustExternalContent();
        private addFooter();
        private addAdditionalFooterText();
    }
}
interface JQueryStatic {
    md: any;
    toptext: () => string;
    affix: (any) => any;
}
interface String {
    startsWith: (x: any) => any;
    endsWith: (x: any) => any;
}
declare module MDwiki.Gimmick {
    interface IMultilineGimmickHandler {
        (trigger: string, content: string, options: any, domElement: any): void;
    }
    interface ISinglelineGimmickCallback {
        (trigger: string, content: string, options: any, domElement: any): void;
    }
    interface ILinkGimmickHandler {
        (trigger: string, text: string, options: any, domElement: any): any;
    }
    class GimmickHandler {
        callback: Function;
        loadStage: string;
        kind: string;
        trigger: string;
        gimmick: Gimmick;
        gimmickReference: Gimmick;
        constructor(kind?: string, callback?: Function);
    }
    class ScriptResource {
        url: string;
        loadstage: string;
        finishstage: string;
        constructor(url: string, loadstage?: string, finishstage?: string);
    }
    class Gimmick {
        name: string;
        handlers: GimmickHandler[];
        stages: StageChain;
        private initFunctions;
        initFunction(initFn: Function): void;
        init(stageLoader: any): void;
        constructor(name: string, handler?: GimmickHandler);
        addHandler(handler: GimmickHandler): void;
        findHandler(kind: string, trigger: string): any;
        registerScriptResource(res: ScriptResource): void;
    }
    class GimmickLoader {
        private globalGimmickRegistry;
        private domElement;
        private stages;
        constructor(stageChain: any, domElement?: any);
        selectHandler(kind: string, trigger: string): GimmickHandler;
        private findGimmick(name);
        registerGimmick(gmck: Gimmick): void;
        initializeGimmick(name: string, doneCallback: Function): void;
        initializeGimmicks(parser: GimmickParser): void;
        subscribeGimmickExecution(parser: GimmickParser): void;
    }
}
declare module MDwiki.Gimmick {
    class MultilineGimmickReference {
        trigger: string;
        text: string;
        domElement: JQuery;
        options: any;
    }
    class SinglelineGimmickReference {
        trigger: string;
        text: string;
        domElement: JQuery;
        options: any;
    }
    class LinkGimmickReference {
        trigger: string;
        domElement: JQuery;
        options: any;
        text: string;
    }
    class GimmickParser {
        domElement: JQuery;
        multilineReferences: MultilineGimmickReference[];
        singlelineReferences: SinglelineGimmickReference[];
        linkReferences: any[];
        constructor(domElement: any);
        parse(): void;
        private extractOptionsFromMagicString(s);
        private getLinkGimmicks();
        private getSinglelineGimmicks();
        private getMultilineGimmicks();
    }
}
declare class JsxRender {
    createElement: (tagName: string, attributes?: {
        [key: string]: any;
    }, ...children: (HTMLElement | string)[]) => HTMLElement;
    __spread(): void;
    private appendChild;
}
declare let heading: string;
declare let arr: number[];
declare let rendered: any;
declare module MDwiki.Util {
    enum LogLevel {
        TRACE = 0,
        DEBUG = 1,
        INFO = 2,
        WARN = 3,
        ERROR = 4,
        FATAL = 5,
    }
    class Logger {
        private logLevel;
        constructor(level: LogLevel);
        private log(loglevel, msg);
        trace(msg: string): void;
        info(msg: string): void;
        debug(msg: string): void;
        warn(msg: string): void;
        error(msg: string): void;
        fatal(msg: string): void;
    }
}
declare var MDwikiEnableDebug: any;
declare var marked: any;
interface JQuery {
    toptext: () => string;
}
declare module MDwiki.Markdown {
    class MarkdownPostprocessing {
        process(dom: JQuery): void;
        private removeLangPrefix(code);
    }
    class Markdown {
        markdownSource: string;
        options: any;
        private defaultOptions;
        constructor(markdownSource: string, options?: any);
        transform(): string;
    }
    class Navbar {
        private navbarMarkdown;
        private uglyHtml;
        constructor(navbarMarkdown: string);
        render(): void;
        hideIfHasNoLinks(): void;
    }
}
declare module MDwiki.DataModels {
    class NavigationBarParser {
        private navbar;
        private node;
        constructor(node: any);
        parse(): NavigationBarModel;
        private findPageTitle();
        private findTopLevelEntries();
        private findSublevelEntries(ul);
        private getSublevelEntry(el);
    }
    class NavigationBarModel {
        toplevelEntries: ToplevelEntry[];
        pageTitle: string;
    }
    class ToplevelEntry {
        title: string;
        href: string;
        childs: SublevelEntry[];
    }
    class SublevelEntry {
        title: string;
        href: string;
        seperator: boolean;
    }
}
declare var marked: any;
declare module MDwiki.Core {
    interface DoneCallback {
        (): void;
    }
    interface SubscribedFunc {
        (cb: DoneCallback): void;
    }
    class Resource {
        url: string;
        dataType: string;
        constructor(url: string, dataType?: string);
        static fetch(url: string, dataType?: string): JQueryXHR;
    }
}
import SubscribedFunc = MDwiki.Core.SubscribedFunc;
declare module MDwiki.Stages {
    class StageChain {
        private defaultStageNames;
        private stages;
        constructor(stageNames?: string[]);
        reset(): void;
        appendArray(st: Stage[]): void;
        append(s: Stage): void;
        run(): void;
        getStage(name: string): Stage;
    }
    class Stage {
        private allFinishedDfd;
        private isFinished;
        finished(): JQueryPromise<void>;
        private started;
        private numOutstanding;
        private subscribedFuncs;
        name: string;
        constructor(name: string);
        private countdown();
        subscribe(fn: SubscribedFunc): void;
        start(): void;
    }
}
declare module MDwiki.Core {
}
declare var marked: any;
import Gimmick = MDwiki.Gimmick;
import GimmickLoader = MDwiki.Gimmick.GimmickLoader;
import Links = MDwiki.Links;
import StageChain = MDwiki.Stages.StageChain;
import Stage = MDwiki.Stages.Stage;
import dummyutil = MDwiki.Utils.Url;
declare module MDwiki.Core {
    class Wiki {
        stages: StageChain;
        gimmicks: GimmickLoader;
        private domElement;
        private config;
        constructor(gimmickLoader: GimmickLoader, stages: StageChain, domElement?: any);
        run(): void;
        private registerFetchConfigAndNavigation();
        private registerPageTransformation();
        private transformMarkdown(markdown);
        private registerClearContent();
        private registerFetchMarkdown();
        private registerGimmickLoad();
        private registerBuildNavigation(navMD);
        private registerFinalTasks();
    }
}
