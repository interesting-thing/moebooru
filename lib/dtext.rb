require 'cgi'
require 'nokogiri'

module DText
  def parse(str)
    state = ['newline']
    result = ""

    # Normalize newlines.
    str.strip
    str.gsub!(/(\r?\n)/, "\n")
    str.gsub!(/\n{3,}/, "\n\n")
    str = CGI.escapeHTML str

    # Keep newline, use carriage return for split.
    str.gsub!("\n", "\n\r")
    data = str.split("\r")

    # Parse header and list first, line by line.
    data.each do |d|
      result << parseline(d, state)
    end

    # Parse inline tags as a whole.
    result = parseinline(result)

    # Nokogiri ensures valid html output.
    Nokogiri::HTML::DocumentFragment.parse(result).to_html
  end

  def parseinline(str)
    # Short links subtitution:
    str.gsub!(/\[\[(.+?)\]\]/) do # [[title]] or [[title|label]] ;link to wiki
      data = $1.split('|', 2)
      title = data[0]
      label = data[1].nil? ? title : data[1]
      "<a href=\"/wiki/show?title=#{CGI.escape(CGI.unescapeHTML(title.tr(" ", "_")))}\">#{label}</a>"
    end
    str.gsub!(/\{\{(.+?)\}\}/) do # {{post tags here}} ;search post with tags
      "<a href=\"/post?tags=#{CGI.escape(CGI.unescapeHTML($1))}\">#{$1}</a>"
    end

    # Miscellaneous single line tags subtitution.
    str.gsub! /\[b\](.+?)\[\/b\]/, '<strong>\1</strong>'
    str.gsub! /\[i\](.+?)\[\/i\]/, '<em>\1</em>'
    str.gsub! /(post #(\d+))/i, '<a href="/post/show/\2">\1</a>'
    str.gsub! /(forum #(\d+))/i, '<a href="/forum/show/\2">\1</a>'
    str.gsub! /(comment #(\d+))/i, '<a href="/comment/show/\2">\1</a>'
    str.gsub! /(pool #(\d+))/i, '<a href="/pool/show/\2">\1</a>'

    # Single line spoiler tags.
    str.gsub! /\[spoilers?\](.+?)\[\/spoilers?\]/, '<span class="spoiler" onclick="Comment.spoiler(this); return false;"><span class="spoilerwarning">spoiler</span></span><span class="spoilertext" style="display: none">\1</span>'
    str.gsub! /\[spoilers?=(.+?)\](.+?)\[\/spoilers?\]/, '<span class="spoiler" onclick="Comment.spoiler(this); return false;"><span class="spoilerwarning">\1</span></span><span class="spoilertext" style="display: none">\2</span>'

    # Multi line spoiler tags.
    str.gsub! /\[spoilers?\]/, '<span class="spoiler" onclick="Comment.spoiler(this); return false;"><span class="spoilerwarning">spoiler</span></span><div class="spoilertext" style="display: none">'
    str.gsub! /\[spoilers?=(.+?)\]/, '<span class="spoiler" onclick="Comment.spoiler(this); return false;"><span class="spoilerwarning">\1</span></span><div class="spoilertext" style="display: none">'
    str.gsub! /\[\/spoilers?\]/, '</div>'

    # Quote.
    str.gsub! /\[quote\]/, '<blockquote><div>'
    str.gsub! /\[\/quote\]/, '</div></blockquote>'

    str = parseurl(str)

    # Extraneous newlines before closing div are unnecessary.
    str.gsub! /\n+(<\/div>)/, '\1'
    # So are after headers, lists, and blockquotes.
    str.gsub! /(<\/(ul|h\d+|blockquote)>)\n+/, '\1'
    # And after opening blockquote.
    str.gsub! /(<blockquote><div>)\n+/, '\1'
    str.gsub! /\n/, '<br>'
    str
  end

  def parseline(str, state)
    if state.last =~ /\d/ or str =~ /^\*+\s+/
      parselist str, state
    elsif str =~ /^(h[1-6])\.\s*(.+)\n*/
      str = "<#{$1}>#{$2}</#{$1}>"
    else
      str
    end
  end

  def parselist(str, state)
    html = ""
    if not state.last =~ /\d/
      state.push "1"
      html << "<ul>"
    else
      n = (str.split()[0] || "").count("*")
      if n < state.last.to_i
        html << '</ul>' * (state.last.to_i - n)
        state[-1] = n.to_s
      elsif n > state.last.to_i
        html << '<ul>'
        state[-1] = (state.last.to_i + 1).to_s
      end
    end
    if not str =~ /^\*+\s+/
      state.pop
      html << "</ul>"
      return html + parseline(str, state)
    end
    html << str.gsub(/\*+\s+(.+)\n*/, '<li>\1</li>')
  end

  def parseurl(str)
    # Basic URL pattern
    url = /(h?ttps?:\/\/\[?(:{0,2}[\w\-]+)((:{1,2}|\.)[\w\-]+)*\]?(:\d+)*(\/[^\s\n<]*)*)/

    # Substitute url tag in this form:
    str.gsub!(/(^|[\s\(>])#{url}/, '\1<a href="\2">\2</a>')                       # url
    str.gsub!(/&lt;&lt;\s*#{url}\s*\|\s*(.+?)\s*&gt;&gt;/, '<a href="\1">\7</a>') # <<url|label>>
    str.gsub!(/(^|[\s>])&quot;(.+?)&quot;:#{url}/, '\1<a href="\3">\2</a>')       # "label":url
    str.gsub!(/&lt;&lt;\s*#{url}\s*&gt;&gt;/, '<a href="\1">\1</a>')              # <<url>>
    str.gsub!(/<a href="ttp/, '<a href="http')                                    # Fix ttp(s) scheme
    return str
  end

  module_function :parse, :parseline, :parseinline, :parselist, :parseurl
end
