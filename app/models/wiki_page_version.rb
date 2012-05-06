class WikiPageVersion < ActiveRecord::Base
  def author
    return User.find_name(self.user_id)
  end

  def what_updated
    what = []
    if self.version > 1
      what += [:body] if self.body != self.prev.body
      what += [:title] if self.title != self.prev.title
      what += [:is_locked] if self.is_locked != self.prev.is_locked
    else
      what += [:initial]
    end
    return what
  end

  def prev
    WikiPageVersion.first(:conditions => { :wiki_page_id => self.wiki_page_id, :version => self.version - 1 })
  end

  def pretty_title
    self.title.tr("_", " ")
  end

  def to_xml(options = {})
    {:id => id, :created_at => created_at, :updated_at => updated_at, :title => title, :body => body, :updater_id => user_id, :locked => is_locked, :version => version, :post_id => post_id}.to_xml(options.reverse_merge(:root => "wiki_page_version"))
  end

  def to_json(*args)
    {:id => id, :created_at => created_at, :updated_at => updated_at, :title => title, :body => body, :updater_id => user_id, :locked => is_locked, :version => version, :post_id => post_id}.to_json(*args)
  end
end
