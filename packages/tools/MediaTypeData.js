// @flow
/**
 * mediaType is a structure corresponding to MediaType schema data object.
 * contentType is a corresponding string.
 */

import SimpleData from "~/tools/SimpleData";

export default class MediaTypeData extends SimpleData {
  type: string;
  subtype: string;
  contentType: string;
  parameters: Array<Array<string>>;
}

/**
 * Parses a contentType string into MediaTypeData.
 *
 * @export
 * @param {string} contentType  string as per https://en.wikipedia.org/wiki/MIME to be converted
 * @returns              MediaTypeData corresponding to given contentType
 */
export function mediaTypeFromContentType (contentType: string): MediaTypeData {
  const mimeItems = /([^/]*)\/([^;]*);?(.*)/.exec(contentType) || [null, "", "", ""];
  const parameters =
      (mimeItems[3] && mimeItems[3].split(";").map(parameter => parameter.split("=")))
      || null;
  return new MediaTypeData({
    type: mimeItems[1], subtype: mimeItems[2], contentType, parameters,
  });
}

export function mediaTypeFromFilename (filename: string): ?MediaTypeData {
  const extension = /\.([^.]*)$/.exec(filename);
  if (!extension) return undefined;
  const mediaTypes = mediaTypesByExtension(extension[1]);
  if (!mediaTypes || !mediaTypes.length) return undefined;
  return mediaTypes[0];
}

/**
 *  Returns a list of media types associated with extension.
 *  The first entry in the list is the preferred one, based on following heuristics:
 *  1. vnd.* subtypes go last
 *  2. after that, x-* subtypes go second last
 *  3. after that, more specific subtypes are preferred over generic versions
 *  4. after that, more commonly used preferred as per http://fileinfo.com/extension/??? top entry
 */
export function mediaTypesByExtension (extension: string) {
  const contentTypes = (_extensionLookup
      || (_extensionLookup = _createExtensionLookup()))[extension];
  return contentTypes && contentTypes.map(contentType => mediaTypeFromContentType(contentType));
}

let _extensionLookup;


// This content was separate from MediaTypeData also because mmmagic is a native library, and could
// be used in the frontend. However currently mmmagic is disabled, so I'm leaving this (broken)
// functionality here.
// import { MAGIC_MIME_TYPE, MAGIC_MIME_ENCODING, Magic } from "mmmagic";

/*
export async function resolveMediaType (path: string, extension: string, content: any) {
  const extensionMimes = extension && mediaTypesByExtension(extension);
  // TODO(iridian): We might want to inspect media dimensions
  if (extensionMimes) {
    return extensionMimes[0];
  }
  const contentMime = content && await mediaTypeFromContent(content);
  // console.log("resolveMediaType", path, ", by extension:",
  //  extensionMimes && JSON.stringify(extensionMimes[0]) || "",
  //  extensionMimes && extensionMimes.length > 1 && `and ${extensionMimes.length - 1} more` || "");
  if (contentMime) {
    const match = !extensionMimes || extensionMimes.find(candidate =>
      candidate.type === contentMime.type && candidate.subtype === contentMime.subtype);
    if (!match) {
      // Test for text source/data file which the mmmagic doesn't regocnize.
      if ((contentMime.type === "text" && contentMime.subtype === "plain")
        // Test for empty file
        || (contentMime.type === "application" && contentMime.subtype === "x-empty")) {
        return extensionMimes[0];
      }
      console.log("Warning: while determining contentType for file", path,
          ", got mismatching content-based type", contentMime,
          "and extension-based type:", extensionMimes,
          ": defaulting to the content contentType");
    }
    return contentMime;
  }
  if (extensionMimes) {
    return extensionMimes[0];
  }
  console.log("Warning: while determining contentType for file", path,
      ", couldn't determine either extension-based or content-based contentType.",
      "Defaulting to application/octet-stream");
  return mediaTypeFromContentType("application/octet-stream");
}

// const magic = new Magic(MAGIC_MIME_TYPE | MAGIC_MIME_ENCODING);

export async function mediaTypeFromContent (content) {
  throw new Error("Content based media type recognition DISABLED:",
      "mmmagic is not pure js and doesn't work on browsers");
  // const contentType = await new Promise(resolve => magic.detect(content, resolve));
  // return contentType && mediaTypeFromContentType(contentType);
}
*/

function _createExtensionLookup () {
  // TODO(iridian): Implement for real.
  const lookup = {};

  function primary (key) {
    if (lookup[key]) {
      console.log(`INTERNAL ERROR: trying to add another primary for key '${key}', adding as alt`);
      return alt(key);
    }
    return (lookup[key] = []);
  }

  function alt (key) {
    if (!Array.isArray(lookup[key])) {
      console.log(`INTERNAL ERROR: primary missing for alt key '${key}', adding as primary`);
      return primary(key);
    }
    return lookup[key];
  }

  // This list is grabbed from http://www.sitepoint.com/web-foundations/mime-types-complete-list/
  // It already contained an error with missing audio/mpeg for mp3 and fully missing ogg, json

  // TODO(iridian): Investigate http://www.iana.org/assignments/media-types/media-types.xhtml

  primary("3dm").push("x-world/x-3dmf");
  primary("3dmf").push("x-world/x-3dmf");
  primary("a").push("application/octet-stream");
  primary("aab").push("application/x-authorware-bin");
  primary("aam").push("application/x-authorware-map");
  primary("aas").push("application/x-authorware-seg");
  primary("abc").push("text/vnd.abc");
  primary("acgi").push("text/html");
  primary("afl").push("video/animaflex");
  primary("ai").push("application/postscript");
  primary("aif").push("audio/aiff");
  alt("aif").push("audio/x-aiff");
  primary("aifc").push("audio/aiff");
  alt("aifc").push("audio/x-aiff");
  primary("aiff").push("audio/aiff");
  alt("aiff").push("audio/x-aiff");
  primary("aim").push("application/x-aim");
  primary("aip").push("text/x-audiosoft-intra");
  primary("ani").push("application/x-navi-animation");
  primary("aos").push("application/x-nokia-9000-communicator-add-on-software");
  primary("aps").push("application/mime");
  primary("arc").push("application/octet-stream");
  primary("arj").push("application/arj");
  alt("arj").push("application/octet-stream");
  primary("art").push("image/x-jg");
  primary("asf").push("video/x-ms-asf");
  primary("asm").push("text/x-asm");
  primary("asp").push("text/asp");
  primary("asx").push("video/x-ms-asf");
  alt("asx").push("application/x-mplayer2");
  alt("asx").push("video/x-ms-asf-plugin");
  primary("au").push("audio/basic");
  alt("au").push("audio/x-au");
  primary("avi").push("video/avi");
  alt("avi").push("application/x-troff-msvideo");
  alt("avi").push("video/msvideo");
  alt("avi").push("video/x-msvideo");
  primary("avs").push("video/avs-video");
  primary("bcpio").push("application/x-bcpio");
  primary("bin").push("application/octet-stream");
  alt("bin").push("application/mac-binary");
  alt("bin").push("application/macbinary");
  alt("bin").push("application/x-binary");
  alt("bin").push("application/x-macbinary");
  primary("bm").push("image/bmp");
  primary("bmp").push("image/bmp");
  alt("bmp").push("image/x-windows-bmp");
  primary("boo").push("application/book");
  primary("book").push("application/book");
  primary("boz").push("application/x-bzip2");
  primary("bsh").push("application/x-bsh");
  primary("bz").push("application/x-bzip");
  primary("bz2").push("application/x-bzip2");
  primary("c").push("text/plain");
  alt("c").push("text/x-c");
  primary("c++").push("text/plain");
  primary("cat").push("application/vnd.ms-pki.seccat");
  primary("cc").push("text/plain");
  alt("cc").push("text/x-c");
  primary("ccad").push("application/clariscad");
  primary("cco").push("application/x-cocoa");
  primary("cdf").push("application/cdf");
  alt("cdf").push("application/x-cdf");
  alt("cdf").push("application/x-netcdf");
  primary("cer").push("application/pkix-cert");
  alt("cer").push("application/x-x509-ca-cert");
  primary("cha").push("application/x-chat");
  primary("chat").push("application/x-chat");
  primary("class").push("application/java");
  alt("class").push("application/java-byte-code");
  alt("class").push("application/x-java-class");
  primary("com").push("application/octet-stream");
  alt("com").push("text/plain");
  primary("conf").push("text/plain");
  primary("cpio").push("application/x-cpio");
  primary("cpp").push("text/x-c");
  primary("cpt").push("application/mac-compactpro");
  alt("cpt").push("application/x-compactpro");
  alt("cpt").push("application/x-cpt");
  primary("crl").push("application/pkix-crl");
  alt("crl").push("application/pkcs-crl");
  primary("crt").push("application/pkix-cert");
  alt("crt").push("application/x-x509-ca-cert");
  alt("crt").push("application/x-x509-user-cert");
  primary("csh").push("application/x-csh");
  alt("csh").push("text/x-script.csh");
  primary("css").push("text/css");
  alt("css").push("application/x-pointplus");
  primary("cxx").push("text/plain");
  primary("dcr").push("application/x-director");
  primary("deepv").push("application/x-deepv");
  primary("def").push("text/plain");
  primary("der").push("application/x-x509-ca-cert");
  primary("dif").push("video/x-dv");
  primary("dir").push("application/x-director");
  primary("dl").push("video/dl");
  alt("dl").push("video/x-dl");
  primary("doc").push("application/msword");
  primary("dot").push("application/msword");
  primary("dp").push("application/commonground");
  primary("drw").push("application/drafting");
  primary("dump").push("application/octet-stream");
  primary("dv").push("video/x-dv");
  primary("dvi").push("application/x-dvi");
  primary("dwf").push("drawing/x-dwf2");
  alt("dwf").push("model/vnd.dwf");
  primary("dwg").push("application/acad");
  alt("dwg").push("image/vnd.dwg");
  alt("dwg").push("image/x-dwg");
  primary("dxf").push("application/dxf");
  alt("dxf").push("image/vnd.dwg");
  alt("dxf").push("image/x-dwg");
  primary("dxr").push("application/x-director");
  primary("el").push("text/x-script.elisp");
  primary("elc").push("application/x-bytecode.elisp");
  alt("elc").push("application/x-elc");
  primary("env").push("application/x-envoy");
  primary("eps").push("application/postscript");
  primary("es").push("application/x-esrehber");
  primary("etx").push("text/x-setext");
  primary("evy").push("application/envoy");
  alt("evy").push("application/x-envoy");
  primary("exe").push("application/octet-stream");
  // Added explicitly: this is what mmmagic recognizes exe files as
  alt("exe").push("application/x-dosexec");

  primary("f").push("text/plain");
  alt("f").push("text/x-fortran");
  primary("f77").push("text/x-fortran");
  primary("f90").push("text/plain");
  alt("f90").push("text/x-fortran");
  primary("fdf").push("application/vnd.fdf");
  primary("fif").push("image/fif");
  alt("fif").push("application/fractals");
  primary("fli").push("video/fli");
  alt("fli").push("video/x-fli");
  primary("flo").push("image/florian");
  primary("flx").push("text/vnd.fmi.flexstor");
  primary("fmf").push("video/x-atomic3d-feature");
  primary("for").push("text/plain");
  alt("for").push("text/x-fortran");
  primary("fpx").push("image/vnd.fpx");
  alt("fpx").push("image/vnd.net-fpx");
  primary("frl").push("application/freeloader");
  primary("funk").push("audio/make");
  primary("g").push("text/plain");
  primary("g3").push("image/g3fax");
  primary("gif").push("image/gif");
  primary("gl").push("video/gl");
  alt("gl").push("video/x-gl");
  primary("gsd").push("audio/x-gsm");
  primary("gsm").push("audio/x-gsm");
  primary("gsp").push("application/x-gsp");
  primary("gss").push("application/x-gss");
  primary("gtar").push("application/x-gtar");
  primary("gz").push("application/x-gzip");
  alt("gz").push("application/x-compressed");
  primary("gzip").push("application/x-gzip");
  alt("gzip").push("multipart/x-gzip");
  primary("h").push("text/plain");
  alt("h").push("text/x-h");
  primary("hdf").push("application/x-hdf");
  primary("help").push("application/x-helpfile");
  primary("hgl").push("application/vnd.hp-hpgl");
  primary("hh").push("text/plain");
  alt("hh").push("text/x-h");
  primary("hlb").push("text/x-script");
  primary("hlp").push("application/hlp");
  alt("hlp").push("application/x-helpfile");
  alt("hlp").push("application/x-winhelp");
  primary("hpg").push("application/vnd.hp-hpgl");
  primary("hpgl").push("application/vnd.hp-hpgl");
  primary("hqx").push("application/binhex");
  alt("hqx").push("application/binhex4");
  alt("hqx").push("application/mac-binhex");
  alt("hqx").push("application/mac-binhex40");
  alt("hqx").push("application/x-binhex40");
  alt("hqx").push("application/x-mac-binhex40");
  primary("hta").push("application/hta");
  primary("htc").push("text/x-component");
  primary("htm").push("text/html");
  primary("html").push("text/html");
  primary("htmls").push("text/html");
  primary("htt").push("text/webviewhtml");
  primary("htx").push("text/html");
  primary("ice").push("x-conference/x-cooltalk");
  primary("ico").push("image/x-icon");
  primary("idc").push("text/plain");
  primary("ief").push("image/ief");
  primary("iefs").push("image/ief");
  primary("iges").push("application/iges");
  alt("iges").push("model/iges");
  primary("igs").push("application/iges");
  alt("igs").push("model/iges");
  primary("ima").push("application/x-ima");
  primary("imap").push("application/x-httpd-imap");
  primary("inf").push("application/inf");
  primary("ins").push("application/x-internett-signup");
  primary("ip").push("application/x-ip2");
  primary("isu").push("video/x-isvideo");
  primary("it").push("audio/it");
  primary("iv").push("application/x-inventor");
  primary("ivr").push("i-world/i-vrml");
  primary("ivy").push("application/x-livescreen");
  primary("jam").push("audio/x-jam");
  primary("jav").push("text/plain");
  alt("jav").push("text/x-java-source");
  primary("java").push("text/plain");
  alt("java").push("text/x-java-source");
  primary("jcm").push("application/x-java-commerce");
  primary("jfif").push("image/jpeg");
  alt("jfif").push("image/pjpeg");
  primary("jfif-tbnl").push("image/jpeg");
  primary("jpe").push("image/jpeg");
  alt("jpe").push("image/pjpeg");
  primary("jpeg").push("image/jpeg");
  alt("jpeg").push("image/pjpeg");
  primary("jpg").push("image/jpeg");
  alt("jpg").push("image/pjpeg");
  primary("jps").push("image/x-jps");
  primary("js").push("application/javascript");
  alt("js").push("application/x-javascript");
  alt("js").push("application/ecmascript");
  alt("js").push("text/javascript");
  alt("js").push("text/ecmascript");
  // Explicitly added
  primary("jsx").push("text/jsx");
  primary("vsx").push("text/vsx");
  primary("vs").push("application/valoscript");
  alt("vs").push("application/valaascript");
  alt("vs").push("text/valoscript");
  alt("vs").push("text/valaascript");
  primary("vss").push("application/valoscript");
  alt("vss").push("application/valaascript");
  alt("vss").push("text/valoscript");
  alt("vss").push("text/valaascript");
  primary("json").push("application/json");
  alt("json").push("application/x-javascript");
  alt("json").push("text/javascript");
  alt("json").push("text/x-javascript");
  alt("json").push("text/x-json");

  primary("jut").push("image/jutvision");
  primary("kar").push("audio/midi");
  alt("kar").push("music/x-karaoke");
  primary("ksh").push("application/x-ksh");
  alt("ksh").push("text/x-script.ksh");
  primary("la").push("audio/nspaudio");
  alt("la").push("audio/x-nspaudio");
  primary("lam").push("audio/x-liveaudio");
  primary("latex").push("application/x-latex");
  primary("lha").push("application/lha");
  alt("lha").push("application/octet-stream");
  alt("lha").push("application/x-lha");
  primary("lhx").push("application/octet-stream");
  primary("list").push("text/plain");
  primary("lma").push("audio/nspaudio");
  alt("lma").push("audio/x-nspaudio");
  primary("log").push("text/plain");
  primary("lsp").push("application/x-lisp");
  alt("lsp").push("text/x-script.lisp");
  primary("lst").push("text/plain");
  primary("lsx").push("text/x-la-asf");
  primary("ltx").push("application/x-latex");
  primary("lzh").push("application/octet-stream");
  alt("lzh").push("application/x-lzh");
  primary("lzx").push("application/lzx");
  alt("lzx").push("application/octet-stream");
  alt("lzx").push("application/x-lzx");
  primary("m").push("text/plain");
  alt("m").push("text/x-m");
  primary("m1v").push("video/mpeg");
  primary("m2a").push("audio/mpeg");
  primary("m2v").push("video/mpeg");
  primary("m3u").push("audio/x-mpequrl");
  primary("man").push("application/x-troff-man");
  primary("map").push("application/x-navimap");
  primary("mar").push("text/plain");
  primary("mbd").push("application/mbedlet");
  primary("mc$").push("application/x-magic-cap-package-1.0");
  primary("mcd").push("application/mcad");
  alt("mcd").push("application/x-mathcad");
  primary("mcf").push("image/vasa");
  alt("mcf").push("text/mcf");
  primary("mcp").push("application/netmc");
  primary("me").push("application/x-troff-me");
  primary("mht").push("message/rfc822");
  primary("mhtml").push("message/rfc822");
  primary("mid").push("audio/midi");
  alt("mid").push("application/x-midi");
  alt("mid").push("audio/x-mid");
  alt("mid").push("audio/x-midi");
  alt("mid").push("music/crescendo");
  alt("mid").push("x-music/x-midi");
  primary("midi").push("audio/midi");
  alt("midi").push("application/x-midi");
  alt("midi").push("audio/x-mid");
  alt("midi").push("audio/x-midi");
  alt("midi").push("music/crescendo");
  alt("midi").push("x-music/x-midi");
  primary("mif").push("application/x-mif");
  alt("mif").push("application/x-frame");
  primary("mime").push("message/rfc822");
  alt("mime").push("www/mime");
  primary("mjf").push("audio/x-vnd.audioexplosion.mjuicemediafile");
  primary("mjpg").push("video/x-motion-jpeg");
  primary("mm").push("application/base64");
  alt("mm").push("application/x-meme");
  primary("mme").push("application/base64");
  primary("mod").push("audio/mod");
  alt("mod").push("audio/x-mod");
  primary("moov").push("video/quicktime");
  primary("mov").push("video/quicktime");
  primary("movie").push("video/x-sgi-movie");
  primary("mp2").push("video/mpeg");
  alt("mp2").push("audio/mpeg");
  alt("mp2").push("audio/x-mpeg");
  alt("mp2").push("video/x-mpeg");
  alt("mp2").push("video/x-mpeq2a");
  // Added to list
  primary("mp3").push("audio/mpeg");
  alt("mp3").push("audio/mpeg3");
  alt("mp3").push("audio/x-mpeg-3");
  alt("mp3").push("video/mpeg");
  alt("mp3").push("video/x-mpeg");
  primary("mpa").push("audio/mpeg");
  alt("mpa").push("video/mpeg");
  primary("mpc").push("application/x-project");
  primary("mpe").push("video/mpeg");
  primary("mpeg").push("video/mpeg");
  primary("mpg").push("video/mpeg");
  alt("mpg").push("audio/mpeg");
  primary("mpga").push("audio/mpeg");
  primary("mpp").push("application/vnd.ms-project");
  primary("mpt").push("application/x-project");
  primary("mpv").push("application/x-project");
  primary("mpx").push("application/x-project");
  primary("mrc").push("application/marc");
  primary("ms").push("application/x-troff-ms");
  primary("mv").push("video/x-sgi-movie");
  primary("my").push("audio/make");
  primary("mzz").push("application/x-vnd.audioexplosion.mzz");
  primary("nap").push("image/naplps");
  primary("naplps").push("image/naplps");
  primary("nc").push("application/x-netcdf");
  primary("ncm").push("application/vnd.nokia.configuration-message");
  primary("nif").push("image/x-niff");
  primary("niff").push("image/x-niff");
  primary("nix").push("application/x-mix-transfer");
  primary("nsc").push("application/x-conference");
  primary("nvd").push("application/x-navidoc");
  primary("o").push("application/octet-stream");
  primary("oda").push("application/oda");
  // Explicitly added
  primary("oga").push("audio/ogg");
  primary("ogg").push("audio/ogg");
  alt("ogg").push("video/ogg");
  alt("ogg").push("application/ogg");
  primary("ogv").push("video/ogg");
  primary("ogx").push("appliation/ogg");

  primary("omc").push("application/x-omc");
  primary("omcd").push("application/x-omcdatamaker");
  primary("omcr").push("application/x-omcregerator");
  primary("p").push("text/x-pascal");
  primary("p10").push("application/pkcs10");
  alt("p10").push("application/x-pkcs10");
  primary("p12").push("application/pkcs-12");
  alt("p12").push("application/x-pkcs12");
  primary("p7a").push("application/x-pkcs7-signature");
  primary("p7c").push("application/pkcs7-mime");
  alt("p7c").push("application/x-pkcs7-mime");
  primary("p7m").push("application/pkcs7-mime");
  alt("p7m").push("application/x-pkcs7-mime");
  primary("p7r").push("application/x-pkcs7-certreqresp");
  primary("p7s").push("application/pkcs7-signature");
  primary("part").push("application/pro_eng");
  primary("pas").push("text/pascal");
  primary("pbm").push("image/x-portable-bitmap");
  primary("pcl").push("application/x-pcl");
  alt("pcl").push("application/vnd.hp-pcl");
  primary("pct").push("image/x-pict");
  primary("pcx").push("image/x-pcx");
  primary("pdb").push("chemical/x-pdb");
  primary("pdf").push("application/pdf");
  primary("pfunk").push("audio/make");
  alt("pfunk").push("audio/make.my.funk");
  primary("pgm").push("image/x-portable-graymap");
  primary("pic").push("image/pict");
  primary("pict").push("image/pict");
  primary("pkg").push("application/x-newton-compatible-pkg");
  primary("pko").push("application/vnd.ms-pki.pko");
  primary("pl").push("text/plain");
  alt("pl").push("text/x-script.perl");
  primary("plx").push("application/x-pixclscript");
  primary("pm").push("image/x-xpixmap");
  alt("pm").push("text/x-script.perl-module");
  primary("pm4").push("application/x-pagemaker");
  primary("pm5").push("application/x-pagemaker");
  primary("png").push("image/png");
  primary("pnm").push("image/x-portable-anymap");
  alt("pnm").push("application/x-portable-anymap");
  primary("pot").push("application/mspowerpoint");
  alt("pot").push("application/vnd.ms-powerpoint");
  primary("pov").push("model/x-pov");
  primary("ppa").push("application/vnd.ms-powerpoint");
  primary("ppm").push("image/x-portable-pixmap");
  primary("pps").push("application/mspowerpoint");
  alt("pps").push("application/vnd.ms-powerpoint");
  primary("ppt").push("application/powerpoint");
  alt("ppt").push("application/mspowerpoint");
  alt("ppt").push("application/vnd.ms-powerpoint");
  alt("ppt").push("application/x-mspowerpoint");
  primary("ppz").push("application/mspowerpoint");
  primary("pre").push("application/x-freelance");
  primary("prt").push("application/pro_eng");
  primary("ps").push("application/postscript");
  primary("psd").push("application/octet-stream");
  primary("pvu").push("paleovu/x-pv");
  primary("pwz").push("application/vnd.ms-powerpoint");
  primary("py").push("text/x-script.phyton");
  primary("pyc").push("application/x-bytecode.python");
  primary("qcp").push("audio/vnd.qcelp");
  primary("qd3").push("x-world/x-3dmf");
  primary("qd3d").push("x-world/x-3dmf");
  primary("qif").push("image/x-quicktime");
  primary("qt").push("video/quicktime");
  primary("qtc").push("video/x-qtc");
  primary("qti").push("image/x-quicktime");
  primary("qtif").push("image/x-quicktime");
  primary("ra").push("audio/x-realaudio");
  alt("ra").push("audio/x-pn-realaudio");
  alt("ra").push("audio/x-pn-realaudio-plugin");
  primary("ram").push("audio/x-pn-realaudio");
  primary("ras").push("image/cmu-raster");
  alt("ras").push("application/x-cmu-raster");
  alt("ras").push("image/x-cmu-raster");
  primary("rast").push("image/cmu-raster");
  primary("rexx").push("text/x-script.rexx");
  primary("rf").push("image/vnd.rn-realflash");
  primary("rgb").push("image/x-rgb");
  primary("rm").push("audio/x-pn-realaudio");
  alt("rm").push("application/vnd.rn-realmedia");
  primary("rmi").push("audio/mid");
  primary("rmm").push("audio/x-pn-realaudio");
  primary("rmp").push("audio/x-pn-realaudio-plugin");
  alt("rmp").push("audio/x-pn-realaudio");
  primary("rng").push("application/ringing-tones");
  alt("rng").push("application/vnd.nokia.ringing-tone");
  primary("rnx").push("application/vnd.rn-realplayer");
  primary("roff").push("application/x-troff");
  primary("rp").push("image/vnd.rn-realpix");
  primary("rpm").push("audio/x-pn-realaudio-plugin");
  primary("rt").push("text/richtext");
  alt("rt").push("text/vnd.rn-realtext");
  primary("rtf").push("application/rtf");
  alt("rtf").push("application/x-rtf");
  alt("rtf").push("text/richtext");
  // this could be text/richtext as well?
  primary("rtx").push("application/rtf");
  alt("rtx").push("text/richtext");
  primary("rv").push("video/vnd.rn-realvideo");
  primary("s").push("text/x-asm");
  primary("s3m").push("audio/s3m");
  primary("saveme").push("application/octet-stream");
  primary("sbk").push("application/x-tbook");
  primary("scm").push("video/x-scm");
  alt("scm").push("application/x-lotusscreencam");
  alt("scm").push("text/x-script.guile");
  alt("scm").push("text/x-script.scheme");
  primary("sdml").push("text/plain");
  primary("sdp").push("application/sdp");
  alt("sdp").push("application/x-sdp");
  primary("sdr").push("application/sounder");
  primary("sea").push("application/sea");
  alt("sea").push("application/x-sea");
  primary("set").push("application/set");
  primary("sgm").push("text/sgml");
  alt("sgm").push("text/x-sgml");
  primary("sgml").push("text/sgml");
  alt("sgml").push("text/x-sgml");
  primary("sh").push("application/x-sh");
  alt("sh").push("application/x-bsh");
  alt("sh").push("application/x-shar");
  alt("sh").push("text/x-script.sh");
  primary("shar").push("application/x-shar");
  alt("shar").push("application/x-bsh");
  primary("shtml").push("text/html");
  alt("shtml").push("text/x-server-parsed-html");
  primary("sid").push("audio/x-psid");
  primary("sit").push("application/x-sit");
  alt("sit").push("application/x-stuffit");
  primary("skd").push("application/x-koan");
  primary("skm").push("application/x-koan");
  primary("skp").push("application/x-koan");
  primary("skt").push("application/x-koan");
  primary("sl").push("application/x-seelogo");
  primary("smi").push("application/smil");
  primary("smil").push("application/smil");
  primary("snd").push("audio/basic");
  alt("snd").push("audio/x-adpcm");
  primary("sol").push("application/solids");
  primary("spc").push("application/x-pkcs7-certificates");
  alt("spc").push("text/x-speech");
  primary("spl").push("application/futuresplash");
  primary("spr").push("application/x-sprite");
  primary("sprite").push("application/x-sprite");
  primary("src").push("application/x-wais-source");
  primary("ssi").push("text/x-server-parsed-html");
  primary("ssm").push("application/streamingmedia");
  primary("sst").push("application/vnd.ms-pki.certstore");
  primary("step").push("application/step");
  primary("stl").push("application/sla");
  alt("stl").push("application/vnd.ms-pki.stl");
  alt("stl").push("application/x-navistyle");
  primary("stp").push("application/step");
  primary("sv4cpio").push("application/x-sv4cpio");
  primary("sv4crc").push("application/x-sv4crc");
  primary("svf").push("image/x-dwg");
  alt("svf").push("image/vnd.dwg");
  primary("svr").push("application/x-world");
  alt("svr").push("x-world/x-svr");
  primary("swf").push("application/x-shockwave-flash");
  primary("t").push("application/x-troff");
  primary("talk").push("text/x-speech");
  primary("tar").push("application/x-tar");
  primary("tbk").push("application/toolbook");
  alt("tbk").push("application/x-tbook");
  primary("tcl").push("application/x-tcl");
  alt("tcl").push("text/x-script.tcl");
  primary("tcsh").push("text/x-script.tcsh");
  primary("tex").push("application/x-tex");
  primary("texi").push("application/x-texinfo");
  primary("texinfo").push("application/x-texinfo");
  primary("text").push("text/plain");
  alt("text").push("application/plain");
  primary("tgz").push("application/gnutar");
  alt("tgz").push("application/x-compressed");
  primary("tif").push("image/tiff");
  alt("tif").push("image/x-tiff");
  primary("tiff").push("image/tiff");
  alt("tiff").push("image/x-tiff");
  primary("tr").push("application/x-troff");
  primary("tsi").push("audio/tsp-audio");
  primary("tsp").push("audio/tsplayer");
  alt("tsp").push("application/dsptype");
  primary("tsv").push("text/tab-separated-values");
  primary("turbot").push("image/florian");
  primary("txt").push("text/plain");
  primary("uil").push("text/x-uil");
  primary("uni").push("text/uri-list");
  primary("unis").push("text/uri-list");
  primary("unv").push("application/i-deas");
  primary("uri").push("text/uri-list");
  primary("uris").push("text/uri-list");
  primary("ustar").push("application/x-ustar");
  alt("ustar").push("multipart/x-ustar");
  // Exception to the rules: preferring the more specific x-uuencode vs non-x but generic app/o-s
  primary("uu").push("text/x-uuencode");
  alt("uu").push("application/octet-stream");
  primary("uue").push("text/x-uuencode");
  primary("vcd").push("application/x-cdlink");
  primary("vcs").push("text/x-vcalendar");
  primary("vda").push("application/vda");
  primary("vdo").push("video/vdo");
  primary("vew").push("application/groupwise");
  primary("viv").push("video/vivo");
  alt("viv").push("video/vnd.vivo");
  primary("vivo").push("video/vivo");
  alt("vivo").push("video/vnd.vivo");
  primary("vmd").push("application/vocaltec-media-desc");
  primary("vmf").push("application/vocaltec-media-file");
  primary("voc").push("audio/voc");
  alt("voc").push("audio/x-voc");
  primary("vos").push("video/vosaic");
  primary("vox").push("audio/voxware");
  primary("vqe").push("audio/x-twinvq-plugin");
  primary("vqf").push("audio/x-twinvq");
  primary("vql").push("audio/x-twinvq-plugin");
  primary("vrml").push("model/vrml");
  alt("vrml").push("application/x-vrml");
  alt("vrml").push("x-world/x-vrml");
  primary("vrt").push("x-world/x-vrt");
  primary("vsd").push("application/x-visio");
  primary("vst").push("application/x-visio");
  primary("vsw").push("application/x-visio");
  primary("w60").push("application/wordperfect6.0");
  primary("w61").push("application/wordperfect6.1");
  primary("w6w").push("application/msword");
  primary("wav").push("audio/wav");
  alt("wav").push("audio/x-wav");
  primary("wb1").push("application/x-qpro");
  primary("wbmp").push("image/vnd.wap.wbmp");
  primary("web").push("application/vnd.xara");
  primary("wiz").push("application/msword");
  primary("wk1").push("application/x-123");
  primary("wmf").push("windows/metafile");
  primary("wml").push("text/vnd.wap.wml");
  primary("wmlc").push("application/vnd.wap.wmlc");
  primary("wmls").push("text/vnd.wap.wmlscript");
  primary("wmlsc").push("application/vnd.wap.wmlscriptc");
  primary("word").push("application/msword");
  primary("wp").push("application/wordperfect");
  primary("wp5").push("application/wordperfect");
  alt("wp5").push("application/wordperfect6.0");
  primary("wp6").push("application/wordperfect");
  primary("wpd").push("application/wordperfect");
  alt("wpd").push("application/x-wpwin");
  primary("wq1").push("application/x-lotus");
  primary("wri").push("application/mswrite");
  alt("wri").push("application/x-wri");
  primary("wrl").push("model/vrml");
  alt("wrl").push("application/x-world");
  alt("wrl").push("x-world/x-vrml");
  primary("wrz").push("model/vrml");
  alt("wrz").push("x-world/x-vrml");
  primary("wsc").push("text/scriplet");
  primary("wsrc").push("application/x-wais-source");
  primary("wtk").push("application/x-wintalk");
  primary("xbm").push("image/xbm");
  alt("xbm").push("image/x-xbitmap");
  alt("xbm").push("image/x-xbm");
  primary("xdr").push("video/x-amt-demorun");
  primary("xgz").push("xgl/drawing");
  primary("xif").push("image/vnd.xiff");
  primary("xl").push("application/excel");
  primary("xla").push("application/excel");
  alt("xla").push("application/x-excel");
  alt("xla").push("application/x-msexcel");
  primary("xlb").push("application/excel");
  alt("xlb").push("application/vnd.ms-excel");
  alt("xlb").push("application/x-excel");
  primary("xlc").push("application/excel");
  alt("xlc").push("application/vnd.ms-excel");
  alt("xlc").push("application/x-excel");
  primary("xld").push("application/excel");
  alt("xld").push("application/x-excel");
  primary("xlk").push("application/excel");
  alt("xlk").push("application/x-excel");
  primary("xll").push("application/excel");
  alt("xll").push("application/vnd.ms-excel");
  alt("xll").push("application/x-excel");
  primary("xlm").push("application/excel");
  alt("xlm").push("application/vnd.ms-excel");
  alt("xlm").push("application/x-excel");
  primary("xls").push("application/excel");
  alt("xls").push("application/vnd.ms-excel");
  alt("xls").push("application/x-excel");
  alt("xls").push("application/x-msexcel");
  primary("xlt").push("application/excel");
  alt("xlt").push("application/x-excel");
  primary("xlv").push("application/excel");
  alt("xlv").push("application/x-excel");
  primary("xlw").push("application/excel");
  alt("xlw").push("application/vnd.ms-excel");
  alt("xlw").push("application/x-excel");
  alt("xlw").push("application/x-msexcel");
  primary("xm").push("audio/xm");
  primary("xml").push("text/xml");
  alt("xml").push("application/xml");
  primary("xmz").push("xgl/movie");
  primary("xpix").push("application/x-vnd.ls-xpix");
  primary("xpm").push("image/xpm");
  alt("xpm").push("image/x-xpixmap");
  primary("x-png").push("image/png");
  primary("xsr").push("video/x-amt-showrun");
  primary("xwd").push("image/x-xwd");
  alt("xwd").push("image/x-xwindowdump");
  primary("xyz").push("chemical/x-pdb");
  primary("z").push("application/x-compressed");
  alt("z").push("application/x-compress");
  primary("zip").push("application/zip");
  alt("zip").push("application/x-compressed");
  alt("zip").push("application/x-zip-compressed");
  alt("zip").push("multipart/x-zip");
  primary("zoo").push("application/octet-stream");
  primary("zsh").push("text/x-script.zsh");
  return lookup;
}
