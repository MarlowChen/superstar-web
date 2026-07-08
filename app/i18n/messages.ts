import enAieroneyours from "@/public/locales/en/aieroneyours.json";
import enAuthcontext from "@/public/locales/en/authcontext.json";
import enCollecting from "@/public/locales/en/collecting.json";
import enComment from "@/public/locales/en/comment.json";
import enCommon from "@/public/locales/en/common.json";
import enDrawing from "@/public/locales/en/drawing.json";
import enEdited from "@/public/locales/en/edited.json";
import enExplore from "@/public/locales/en/explore.json";
import enGallery from "@/public/locales/en/gallery.json";
import enImageEditor from "@/public/locales/en/imageEditor.json";
import enImageViewer from "@/public/locales/en/imageViewer.json";
import enLegal from "@/public/locales/en/legal.json";
import enLibrary from "@/public/locales/en/library.json";
import enLogin from "@/public/locales/en/login.json";
import enLoraModels from "@/public/locales/en/lora-models.json";
import enMagicFeature from "@/public/locales/en/magicFeature.json";
import enModelDetailsDialog from "@/public/locales/en/modelDetailsDialog.json";
import enModels from "@/public/locales/en/models.json";
import enModelview from "@/public/locales/en/modelview.json";
import enNavigation from "@/public/locales/en/navigation.json";
import enPayment from "@/public/locales/en/payment.json";
import enPitch from "@/public/locales/en/pitch.json";
import enSettings from "@/public/locales/en/settings.json";
import enShare from "@/public/locales/en/share.json";
import enStyles from "@/public/locales/en/styles.json";
import enUpgrade from "@/public/locales/en/upgrade.json";
import jaAieroneyours from "@/public/locales/ja/aieroneyours.json";
import jaAuthcontext from "@/public/locales/ja/authcontext.json";
import jaCollecting from "@/public/locales/ja/collecting.json";
import jaComment from "@/public/locales/ja/comment.json";
import jaCommon from "@/public/locales/ja/common.json";
import jaDrawing from "@/public/locales/ja/drawing.json";
import jaEdited from "@/public/locales/ja/edited.json";
import jaExplore from "@/public/locales/ja/explore.json";
import jaGallery from "@/public/locales/ja/gallery.json";
import jaImageEditor from "@/public/locales/ja/imageEditor.json";
import jaImageViewer from "@/public/locales/ja/imageViewer.json";
import jaLegal from "@/public/locales/ja/legal.json";
import jaLibrary from "@/public/locales/ja/library.json";
import jaLogin from "@/public/locales/ja/login.json";
import jaLoraModels from "@/public/locales/ja/lora-models.json";
import jaMagicFeature from "@/public/locales/ja/magicFeature.json";
import jaModelDetailsDialog from "@/public/locales/ja/modelDetailsDialog.json";
import jaModels from "@/public/locales/ja/models.json";
import jaModelview from "@/public/locales/ja/modelview.json";
import jaNavigation from "@/public/locales/ja/navigation.json";
import jaPayment from "@/public/locales/ja/payment.json";
import jaPitch from "@/public/locales/ja/pitch.json";
import jaSettings from "@/public/locales/ja/settings.json";
import jaShare from "@/public/locales/ja/share.json";
import jaStyles from "@/public/locales/ja/styles.json";
import jaUpgrade from "@/public/locales/ja/upgrade.json";
import zhTWAieroneyours from "@/public/locales/zh-TW/aieroneyours.json";
import zhTWAuthcontext from "@/public/locales/zh-TW/authcontext.json";
import zhTWCollecting from "@/public/locales/zh-TW/collecting.json";
import zhTWComment from "@/public/locales/zh-TW/comment.json";
import zhTWCommon from "@/public/locales/zh-TW/common.json";
import zhTWDrawing from "@/public/locales/zh-TW/drawing.json";
import zhTWEdited from "@/public/locales/zh-TW/edited.json";
import zhTWExplore from "@/public/locales/zh-TW/explore.json";
import zhTWGallery from "@/public/locales/zh-TW/gallery.json";
import zhTWImageEditor from "@/public/locales/zh-TW/imageEditor.json";
import zhTWImageViewer from "@/public/locales/zh-TW/imageViewer.json";
import zhTWLegal from "@/public/locales/zh-TW/legal.json";
import zhTWLibrary from "@/public/locales/zh-TW/library.json";
import zhTWLogin from "@/public/locales/zh-TW/login.json";
import zhTWLoraModels from "@/public/locales/zh-TW/lora-models.json";
import zhTWMagicFeature from "@/public/locales/zh-TW/magicFeature.json";
import zhTWModelDetailsDialog from "@/public/locales/zh-TW/modelDetailsDialog.json";
import zhTWModels from "@/public/locales/zh-TW/models.json";
import zhTWModelview from "@/public/locales/zh-TW/modelview.json";
import zhTWNavigation from "@/public/locales/zh-TW/navigation.json";
import zhTWPayment from "@/public/locales/zh-TW/payment.json";
import zhTWPitch from "@/public/locales/zh-TW/pitch.json";
import zhTWSettings from "@/public/locales/zh-TW/settings.json";
import zhTWShare from "@/public/locales/zh-TW/share.json";
import zhTWStyles from "@/public/locales/zh-TW/styles.json";
import zhTWUpgrade from "@/public/locales/zh-TW/upgrade.json";

const buildMessages = (
  aieroneyours: unknown,
  authcontext: unknown,
  collecting: unknown,
  comment: unknown,
  common: unknown,
  drawing: unknown,
  edited: unknown,
  explore: unknown,
  gallery: unknown,
  imageEditor: unknown,
  imageViewer: unknown,
  legal: unknown,
  library: unknown,
  login: unknown,
  loraModels: unknown,
  magicFeature: unknown,
  modelDetailsDialog: unknown,
  models: unknown,
  modelview: unknown,
  navigation: unknown,
  payment: unknown,
  pitch: unknown,
  settings: unknown,
  share: unknown,
  styles: unknown,
  upgrade: unknown
) => ({
  aieroneyours,
  authcontext,
  collecting,
  comment,
  common,
  drawing,
  edited,
  explore,
  gallery,
  imageEditor,
  imageViewer,
  legal,
  library,
  login,
  "lora-models": loraModels,
  magicFeature,
  modelDetailsDialog,
  models,
  modelview,
  navigation,
  payment,
  pitch,
  settings,
  share,
  styles,
  upgrade,
});

export const messagesByLocale = {
  en: buildMessages(enAieroneyours, enAuthcontext, enCollecting, enComment, enCommon, enDrawing, enEdited, enExplore, enGallery, enImageEditor, enImageViewer, enLegal, enLibrary, enLogin, enLoraModels, enMagicFeature, enModelDetailsDialog, enModels, enModelview, enNavigation, enPayment, enPitch, enSettings, enShare, enStyles, enUpgrade),
  ja: buildMessages(jaAieroneyours, jaAuthcontext, jaCollecting, jaComment, jaCommon, jaDrawing, jaEdited, jaExplore, jaGallery, jaImageEditor, jaImageViewer, jaLegal, jaLibrary, jaLogin, jaLoraModels, jaMagicFeature, jaModelDetailsDialog, jaModels, jaModelview, jaNavigation, jaPayment, jaPitch, jaSettings, jaShare, jaStyles, jaUpgrade),
  "zh-TW": buildMessages(zhTWAieroneyours, zhTWAuthcontext, zhTWCollecting, zhTWComment, zhTWCommon, zhTWDrawing, zhTWEdited, zhTWExplore, zhTWGallery, zhTWImageEditor, zhTWImageViewer, zhTWLegal, zhTWLibrary, zhTWLogin, zhTWLoraModels, zhTWMagicFeature, zhTWModelDetailsDialog, zhTWModels, zhTWModelview, zhTWNavigation, zhTWPayment, zhTWPitch, zhTWSettings, zhTWShare, zhTWStyles, zhTWUpgrade),
} as const;

export type SupportedLocale = keyof typeof messagesByLocale;
