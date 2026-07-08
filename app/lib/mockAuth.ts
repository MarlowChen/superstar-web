import type { LoraModel, User, UserPoint } from "@/payload-types";

const MOCK_NOW = "2026-01-01T00:00:00.000Z";

export const MOCK_AUTH_TOKEN = "superstar-local-mock-token";

export function isMockAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_IS_MOCK === "true"
  );
}

export function isMockAuthToken(token?: string | null) {
  return token === MOCK_AUTH_TOKEN;
}

export function pickUsableAuthToken(...tokens: Array<string | undefined | null>) {
  return tokens.find((token): token is string =>
    Boolean(token && (isMockAuthEnabled() || !isMockAuthToken(token)))
  );
}

const MOCK_RESULT_IMAGES = [
  "/images/heros/demo/character1.png",
  "/images/heros/demo/character2.png",
  "/images/heros/demo/character5.png",
  "/images/heros/demo/character6.png",
];

const MOCK_RESULT_VIDEO =
  "https://nyc3.digitaloceanspaces.com/aierone/media/%E4%B8%AD%E9%9A%8E%E4%B8%BB%E7%AE%A1.mp4";
const MOCK_RESULT_AUDIO =
  "data:audio/wav;base64,UklGRkQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export type MockGenerationKind = "image" | "video" | "audio";

const normalizeMockGenerationKind = (value: unknown): MockGenerationKind => {
  return value === "video" || value === "audio" ? value : "image";
};

const normalizeMockGenerationCount = (
  value: unknown,
  kind: MockGenerationKind
) => {
  if (kind !== "image") return 1;

  const count = Number(value);
  if (!Number.isFinite(count)) return 1;

  return Math.min(Math.max(Math.round(count), 1), MOCK_RESULT_IMAGES.length);
};

export function createMockGenerationSubmission(body: Record<string, unknown>) {
  const kind = normalizeMockGenerationKind(body.forcedType || body.type || body.kind);
  const count = normalizeMockGenerationCount(body.count, kind);
  const uuid =
    typeof body.uuid === "string" && body.uuid.trim()
      ? body.uuid.trim()
      : `${Date.now()}`;
  const taskId = `mock-${kind}-${count}-${uuid}`;

  return {
    ok: true,
    type: "generation",
    taskId,
    kind,
    count,
    status: "submitted",
    message: {
      role: "ASSISTANT",
      content: "Mock task submitted for local UI QA.",
    },
  };
}

export function createMockGenerationTask(taskId: string) {
  const [, kindSegment, countSegment] =
    taskId.match(/^mock-(image|video|audio)-(\d+)-/) || [];
  const kind = normalizeMockGenerationKind(kindSegment);
  const count = normalizeMockGenerationCount(countSegment, kind);
  const now = new Date().toISOString();
  const resultUrls =
    kind === "image"
      ? MOCK_RESULT_IMAGES.slice(0, count)
      : [kind === "video" ? MOCK_RESULT_VIDEO : MOCK_RESULT_AUDIO];

  return {
    id: taskId,
    _id: taskId,
    status: "COMPLETED",
    kind,
    type: kind,
    prompt: "本機 mock 生成結果",
    expectedCount: resultUrls.length,
    count: resultUrls.length,
    resultCount: resultUrls.length,
    actualCount: resultUrls.length,
    loraModel: kind === "image" ? "圖像生成工作流" : "Mock generation workflow",
    createdAt: now,
    updatedAt: now,
    publishedImages: resultUrls.map((url, index) => ({
      id: `${taskId}-${index + 1}`,
      publishedImageId: `${taskId}-${index + 1}`,
      shortId: kind === "image" ? `mock-${index + 1}` : undefined,
      url,
      reactions: {
        likes: 0,
        dislikes: 0,
        collections: 0,
      },
      userReaction: {
        like: false,
        dislike: false,
        collecting: false,
        comment: "",
      },
    })),
  };
}

export function getMockUser(email = "demo@superstar.local"): User {
  const username = email.split("@")[0] || "demo";

  return {
    id: "local-mock-user",
    name: "Demo Creator",
    username,
    bio: "Local UI QA account",
    avatar: null,
    authProvider: "local",
    sub: null,
    roles: ["user"],
    updatedAt: MOCK_NOW,
    createdAt: MOCK_NOW,
    email,
    resetPasswordToken: null,
    resetPasswordExpiration: null,
    salt: null,
    hash: null,
    loginAttempts: 0,
    lockUntil: null,
    password: null,
  };
}

export const MOCK_USER_POINT: UserPoint = {
  id: "local-mock-user-point",
  user: "local-mock-user",
  points: 1200,
  extraPoints: 200,
  pointType: "FREE",
  expireAt: null,
  updatedAt: MOCK_NOW,
  createdAt: MOCK_NOW,
};

export const MOCK_BILLING_STATUS = {
  canSubscribePayg: true,
  canSubscribePlus: true,
  canSubscribePro: true,
  canSubscribeMax: true,
  hasActiveSubscription: false,
  currentPointType: "FREE",
  currentPeriodEnd: undefined,
  canUpgrade: false,
  availableUpgrades: [],
  activeSubscription: undefined,
};

export const MOCK_USER_SETTINGS = {
  id: "local-mock-user-settings",
  user: "local-mock-user",
  language: "DEFAULT",
  theme: "DARK",
  displayLanguage: "Auto",
  displayTheme: "Dark",
  selectLoraModel: undefined,
  selectStyle: null,
};

const mockImage = (
  id: string,
  url: string,
  likes = 0,
  collections = 0
) => ({
  id,
  url,
  reactions: {
    likes,
    dislikes: 0,
    collections,
  },
  userReaction: {
    like: false,
    dislike: false,
    collecting: collections > 0,
    comment: "",
  },
});

export const MOCK_PUBLISHED_IMAGE_GROUPS = [
  {
    taskId: "mock-task-health-post",
    page: 1,
    limit: 10,
    sort: "desc",
    prompt:
      "保健品牌社群貼文主視覺，溫暖自然光、產品清楚入鏡、人物神情親切可信。",
    loraModelName: "圖像生成工作流",
    userMessage:
      "請幫我做一張適合 Instagram 的保健品牌主視覺，乾淨、有質感。",
    uploadedImages: [mockImage("mock-upload-health-ref", "/images/heros/demo/material1.png")],
    images: [
      mockImage("mock-health-post-1", "/images/heros/demo/character1.png", 12, 1),
      mockImage("mock-health-post-2", "/images/heros/demo/character2.png", 8),
    ],
  },
  {
    taskId: "mock-task-character-views",
    page: 1,
    limit: 10,
    sort: "desc",
    prompt:
      "同一位短影音角色的多角度設定稿，正面、側面、半身、全身一致，乾淨背景。",
    loraModelName: "多角度角色設定",
    userMessage: "生成角色多視圖，用於後續影片與換臉測試。",
    uploadedImages: [mockImage("mock-upload-character-ref", "/images/heros/demo/character5.png")],
    images: [
      mockImage("mock-character-view-1", "/images/heros/demo/character5.png", 20, 1),
      mockImage("mock-character-view-2", "/images/heros/demo/character6.png", 18),
      mockImage("mock-character-view-3", "/images/heros/demo/character7.png", 16),
      mockImage("mock-character-view-4", "/images/heros/demo/character8.png", 14),
    ],
  },
];

export function getMockUserImages(page = 1, limit = 10) {
  const start = Math.max(page - 1, 0) * limit;
  const groups = MOCK_PUBLISHED_IMAGE_GROUPS.slice(start, start + limit);

  return {
    groups,
    total: MOCK_PUBLISHED_IMAGE_GROUPS.length,
    page,
    limit,
  };
}

export function getMockCollectedImages(page = 1, limit = 20) {
  const collectedImages = MOCK_PUBLISHED_IMAGE_GROUPS.flatMap((group) =>
    group.images
      .filter((image) => image.userReaction.collecting)
      .map((image) => ({
        id: `collect-${image.id}`,
        publishedImage: image,
        task: {
          id: group.taskId,
          prompt: group.prompt,
          loraModel: group.taskId,
          loraModelTitle: group.loraModelName,
        },
        user: getMockUser(),
        createdAt: MOCK_NOW,
      }))
  );
  const totalCount = collectedImages.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / limit) : 1;
  const start = Math.max(page - 1, 0) * limit;

  return {
    images: collectedImages.slice(start, start + limit),
    totalPages,
    currentPage: page,
    totalCount,
  };
}

type MockModel = LoraModel & {
  class: string;
  kind: "image" | "video" | "audio" | "text";
  maxReferenceImages?: number;
};

export const MOCK_BASIC_MODELS: MockModel[] = [
  {
    id: "mock-image-studio",
    title: "圖像生成工作流",
    value: "mock-image-studio",
    class: "圖片",
    kind: "image",
    canImageToImage: true,
    maxReferenceImages: 4,
    loraCategories: null,
    cover: null,
    description: "本機 UI 測試用模型，不會呼叫真實生成。",
    reference: null,
    basicSettings: null,
    trainingParams: null,
    workflow: null,
    authors: null,
    updatedAt: MOCK_NOW,
    createdAt: MOCK_NOW,
  },
  {
    id: "mock-video-studio",
    title: "影片生成工作流",
    value: "mock-video-studio",
    class: "影片",
    kind: "video",
    canImageToImage: true,
    maxReferenceImages: 1,
    loraCategories: null,
    cover: null,
    description: "本機 UI 測試用模型，不會呼叫真實生成。",
    reference: null,
    basicSettings: null,
    trainingParams: null,
    workflow: null,
    authors: null,
    updatedAt: MOCK_NOW,
    createdAt: MOCK_NOW,
  },
  {
    id: "mock-voice-studio",
    title: "AI 聲音生成",
    value: "mock-voice-studio",
    class: "聲音",
    kind: "audio",
    canImageToImage: false,
    maxReferenceImages: 0,
    loraCategories: null,
    cover: null,
    description: "本機 UI 測試用模型，不會呼叫真實生成。",
    reference: null,
    basicSettings: null,
    trainingParams: null,
    workflow: null,
    authors: null,
    updatedAt: MOCK_NOW,
    createdAt: MOCK_NOW,
  },
  {
    id: "mock-copy-studio",
    title: "文案與腳本生成",
    value: "mock-copy-studio",
    class: "文案",
    kind: "text",
    canImageToImage: false,
    maxReferenceImages: 0,
    loraCategories: null,
    cover: null,
    description: "本機 UI 測試用模型，不會呼叫真實生成。",
    reference: null,
    basicSettings: null,
    trainingParams: null,
    workflow: null,
    authors: null,
    updatedAt: MOCK_NOW,
    createdAt: MOCK_NOW,
  },
];

const aspectRatioOptions = [
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
];

export const MOCK_MODEL_CAPABILITIES = {
  version: "local-mock",
  submission: {
    endpoint: "/chat/create",
    method: "POST",
    fields: {},
    note: "Local UI QA only. Mock mode does not generate media.",
  },
  media: [
    {
      kind: "image",
      label: "圖片模型",
      models: [
        {
          id: "mock-image-studio",
          modelId: "mock-image-studio",
          source: "local",
          label: "圖像生成工作流",
          description: "文生圖與圖生圖介面測試",
          kind: "image",
          supports: {
            textToImage: true,
            imageToImage: true,
          },
          inputs: {
            text: true,
            images: true,
            audio: false,
            video: false,
          },
          limits: {
            maxReferenceImages: 4,
            imageToImageAllowsSizeSelection: true,
          },
          params: [
            {
              key: "prompt",
              label: "提示詞",
              type: "text",
              required: true,
              placeholder: "描述你想生成的畫面",
            },
            {
              key: "count",
              label: "張數",
              type: "number",
              default: 1,
              min: 1,
              max: 4,
            },
            {
              key: "aspectRatio",
              label: "比例",
              type: "select",
              default: "1:1",
              options: aspectRatioOptions,
            },
            {
              key: "resolution",
              label: "解析度",
              type: "select",
              default: "1024x1024",
              options: [
                { value: "1024x1024", label: "1024" },
                { value: "1536x1536", label: "1536" },
              ],
            },
          ],
          submit: {
            endpoint: "/chat/create",
            method: "POST",
            type: "image",
            modelId: "mock-image-studio",
          },
        },
      ],
    },
    {
      kind: "video",
      label: "影片模型",
      models: [
        {
          id: "mock-video-studio",
          modelId: "mock-video-studio",
          source: "local",
          label: "影片生成工作流",
          description: "文生影片與圖生影片介面測試",
          kind: "video",
          supports: {
            textToVideo: true,
            imageToVideo: true,
          },
          inputs: {
            text: true,
            images: true,
            audio: false,
            video: false,
          },
          limits: {
            maxReferenceImages: 1,
          },
          params: [
            {
              key: "prompt",
              label: "提示詞",
              type: "text",
              required: true,
              placeholder: "描述影片內容",
            },
            {
              key: "aspectRatio",
              label: "比例",
              type: "select",
              default: "9:16",
              options: aspectRatioOptions,
            },
            {
              key: "duration",
              label: "秒數",
              type: "select",
              default: "5",
              options: [
                { value: "5", label: "5s" },
                { value: "10", label: "10s" },
              ],
            },
          ],
          submit: {
            endpoint: "/chat/create",
            method: "POST",
            type: "video",
            modelId: "mock-video-studio",
          },
        },
      ],
    },
    {
      kind: "audio",
      label: "聲音模型",
      models: [
        {
          id: "mock-voice-studio",
          modelId: "mock-voice-studio",
          source: "local",
          label: "AI 聲音生成",
          description: "文字轉語音介面測試",
          kind: "audio",
          supports: {
            textToAudio: true,
          },
          inputs: {
            text: true,
            images: false,
            audio: false,
            video: false,
          },
          params: [
            {
              key: "prompt",
              label: "聲音腳本",
              type: "text",
              required: true,
              placeholder: "輸入要朗讀的文案",
            },
          ],
          submit: {
            endpoint: "/chat/create",
            method: "POST",
            type: "audio",
            modelId: "mock-voice-studio",
          },
        },
      ],
    },
    {
      kind: "text",
      label: "文案模型",
      models: [
        {
          id: "mock-copy-studio",
          modelId: "mock-copy-studio",
          source: "local",
          label: "文案與腳本生成",
          description: "貼文、腳本、靈感對話介面測試",
          kind: "text",
          supports: {},
          inputs: {
            text: true,
            images: false,
            audio: false,
            video: false,
          },
          params: [
            {
              key: "prompt",
              label: "需求",
              type: "text",
              required: true,
              placeholder: "描述要產出的文案或腳本",
            },
          ],
          submit: {
            endpoint: "/chat/create",
            method: "POST",
            type: "chat",
            modelId: "mock-copy-studio",
          },
        },
      ],
    },
  ],
};

export const MOCK_TEMPLATES = [
  {
    id: "mock-template-beauty-post",
    title: "保健品牌社群主視覺",
    slug: "mock-beauty-health-post",
    category: "image",
    summary: "適合保健、美妝、生活品牌的乾淨人物情境圖。",
    prompt:
      "一張乾淨明亮的保健品牌社群主視覺，人物自然微笑，產品放在畫面前景，柔和棚拍光線，高質感商業攝影。",
    negativePrompt: "低畫質、手部變形、文字錯誤、過度磨皮",
    tags: ["品牌圖", "保健", "社群貼文", "人物"],
    isFeatured: true,
    cover: {
      url: "/images/heros/demo/character1.png",
      alt: "保健品牌社群主視覺",
    },
    imageConfig: {
      referenceImageCount: 1,
      referenceImages: [
        {
          id: "mock-ref-beauty-post",
          url: "/images/heros/demo/character1.png",
        },
      ],
      defaultAspectRatio: "4:5",
      defaultCount: 2,
      suggestedModel: "mock-image-studio",
    },
    videoConfig: null,
  },
  {
    id: "mock-template-character-views",
    title: "角色多角度形象設定",
    slug: "mock-character-multiview",
    category: "image",
    summary: "用於角色一致性、多視圖、短影音角色設計前置。",
    prompt:
      "同一位角色的多角度形象設定，正面、側面、半身、全身，服裝細節一致，乾淨背景，角色設計稿風格。",
    negativePrompt: "不同人物、五官不一致、服裝錯亂、模糊",
    tags: ["角色", "多角度", "設定稿", "短影音"],
    isFeatured: true,
    cover: {
      url: "/images/heros/demo/character5.png",
      alt: "角色多角度形象設定",
    },
    imageConfig: {
      referenceImageCount: 4,
      referenceImages: [
        {
          id: "mock-ref-character-front",
          url: "/images/heros/demo/character5.png",
        },
        {
          id: "mock-ref-character-side",
          url: "/images/heros/demo/character6.png",
        },
      ],
      defaultAspectRatio: "1:1",
      defaultCount: 4,
      suggestedModel: "mock-image-studio",
    },
    videoConfig: null,
  },
  {
    id: "mock-template-product-reel",
    title: "商品短影音開場",
    slug: "mock-product-reel-opener",
    category: "video",
    summary: "商品由暗到亮進場，適合短影音前三秒吸睛畫面。",
    prompt:
      "商品短影音開場，鏡頭由近到遠，產品被柔和光線打亮，背景乾淨，有高級商業廣告感。",
    tags: ["短影音", "商品", "開場", "廣告"],
    isFeatured: true,
    cover: {
      url: "/images/banner/aierone-Q2-6952788aaa70210e4ef6e37a.jpg",
      alt: "商品短影音開場",
    },
    imageConfig: null,
    videoConfig: {
      demoPoster: {
        url: "/images/banner/aierone-Q2-6952788aaa70210e4ef6e37a.jpg",
      },
      demoVideo: null,
    },
  },
  {
    id: "mock-template-lip-sync",
    title: "人物對嘴口播模板",
    slug: "mock-lip-sync-spokesperson",
    category: "video",
    summary: "適合人物口播、品牌介紹、活動短片的對嘴流程。",
    prompt:
      "一位自然親切的人物面對鏡頭口播，背景簡潔，表情自然，有商業影片質感。",
    tags: ["對嘴", "口播", "人物", "品牌介紹"],
    isFeatured: false,
    cover: {
      url: "/images/heros/demo/character10.png",
      alt: "人物對嘴口播模板",
    },
    imageConfig: null,
    videoConfig: {
      demoPoster: {
        url: "/images/heros/demo/character10.png",
      },
      demoVideo: null,
    },
  },
];
